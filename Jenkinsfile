// ShopKart CI: test -> SonarQube -> Trivy (source) -> build -> Trivy (image) -> push
pipeline {
  agent any

  options {
    skipDefaultCheckout(true)          // we check out explicitly in the Checkout stage
    timeout(time: 45, unit: 'MINUTES') // no build hangs forever
    buildDiscarder(logRotator(numToKeepStr: '15'))
    disableConcurrentBuilds()
    timestamps()
  }

  triggers {
    // GitHub webhooks can't reach Jenkins (SG allows only my IP), so poll Git every ~2 minutes
    pollSCM('H/2 * * * *')
  }

  tools { nodejs 'node24' }

  environment {
    // Credential IDs: the secrets live in Jenkins, never in Git
    DOCKERHUB_CREDS = 'dockerhub'
    // Image names
    REGISTRY_USER   = 'vkashs'
    BACKEND_IMAGE   = "${REGISTRY_USER}/shopkart-backend"
    FRONTEND_IMAGE  = "${REGISTRY_USER}/shopkart-frontend"
    // Per-build Docker login, deleted with the workspace
    DOCKER_CONFIG   = "${WORKSPACE}/.docker"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
          currentBuild.displayName = "#${BUILD_NUMBER} ${env.GIT_SHA}"
        }
      }
    }

    stage('Test') {
      // Backend and frontend tests run at the same time
      parallel {
        stage('Backend tests')  { steps { dir('backend')  { sh 'npm ci && npm test' } } }
        stage('Frontend tests') { steps { dir('frontend') { sh 'npm ci && npm test' } } }
      }
    }

    stage('SonarQube: backend') {
      steps {
        dir('backend') {
          withSonarQubeEnv('sonar') { sh "${tool 'sonar-scanner'}/bin/sonar-scanner" }
        }
        // SonarQube calls our webhook; stop the pipeline if the quality gate fails
        timeout(time: 5, unit: 'MINUTES') { waitForQualityGate abortPipeline: true }
      }
    }

    stage('SonarQube: frontend') {
      steps {
        dir('frontend') {
          withSonarQubeEnv('sonar') { sh "${tool 'sonar-scanner'}/bin/sonar-scanner" }
        }
        timeout(time: 5, unit: 'MINUTES') { waitForQualityGate abortPipeline: true }
      }
    }

    stage('Trivy: source scan') {
      steps {
        // Full report (HIGH+CRITICAL) as an artifact, then a gate that fails on CRITICAL
        sh '''
          trivy fs --scanners vuln,secret,misconfig --skip-dirs "**/node_modules" \
            --severity HIGH,CRITICAL --no-progress --format table --output trivy-fs-report.txt .
          trivy fs --scanners vuln,secret,misconfig --skip-dirs "**/node_modules" \
            --severity CRITICAL --exit-code 1 --no-progress .
        '''
      }
    }

    stage('Docker build') {
      steps {
        sh '''
          docker build --pull -t ${BACKEND_IMAGE}:${GIT_SHA}  backend
          docker build --pull -t ${FRONTEND_IMAGE}:${GIT_SHA} frontend
        '''
      }
    }

    stage('Trivy: image scan') {
      steps {
        // Scans the base OS + libraries inside the final images; fails on fixable CRITICAL CVEs
        sh '''
          for img in ${BACKEND_IMAGE}:${GIT_SHA} ${FRONTEND_IMAGE}:${GIT_SHA}; do
            echo "== $img ==" >> trivy-image-report.txt
            trivy image --severity HIGH,CRITICAL --no-progress --format table "$img" >> trivy-image-report.txt
            trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 --no-progress "$img"
          done
        '''
      }
    }

    stage('Push to Docker Hub') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS,
                         usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          // Single quotes: the shell reads the secret at runtime, so Groovy never embeds it
          sh '''
            mkdir -p "$DOCKER_CONFIG"
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            docker push ${BACKEND_IMAGE}:${GIT_SHA}
            docker push ${FRONTEND_IMAGE}:${GIT_SHA}
            docker logout
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'trivy-*.txt', allowEmptyArchive: true
      // Free disk on the master: remove this build's images and dangling layers
      sh '''
        docker rmi ${BACKEND_IMAGE}:${GIT_SHA} ${FRONTEND_IMAGE}:${GIT_SHA} 2>/dev/null || true
        docker image prune -f
      '''
      deleteDir()
    }
  }
}
