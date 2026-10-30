// ShopKart CI Pipeline: Automates code quality verification, security scanning, container builds,
// and GitOps release triggering for the ShopKart application.
// Connects code changes in this repository to Docker Hub publishing and GitOps manifest updates in shopkart-gitops.
//
// Trigger:
//   pollSCM('H/2 * * * *') - polls Git repository every 2 minutes (avoids exposing Jenkins to public GitHub webhooks)
// Tools:
//   node24 (Node.js runtime for testing), sonar-scanner (static code analysis scanner CLI)
// Credentials:
//   dockerhub    - Docker Hub credentials for container registry authentication
//   sonar-token  - Managed implicitly by withSonarQubeEnv('sonar') to authenticate with SonarQube server
//   github-token - GitHub personal access token used to clone and commit new tags to shopkart-gitops
// Stage Flow:
//   Checkout -> Test (parallel) -> SonarQube (backend & frontend) -> Trivy (source) ->
//   Docker build -> Trivy (image) -> Push to Docker Hub -> Update GitOps repo

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
    // Poll Git every ~2 minutes because the security group restricts Jenkins access to private IP only
    pollSCM('H/2 * * * *')
  }

  tools { nodejs 'node24' }

  environment {
    // Credential IDs: the secrets live in Jenkins, never in Git
    DOCKERHUB_CREDS = 'dockerhub'
    GITHUB_CREDS    = 'github-token'
    // Image names
    REGISTRY_USER   = 'vkashs'
    BACKEND_IMAGE   = "${REGISTRY_USER}/shopkart-backend"
    FRONTEND_IMAGE  = "${REGISTRY_USER}/shopkart-frontend"
    // Per-build isolated Docker login directory; DOCKER_CONFIG ensures credentials are deleted with workspace
    DOCKER_CONFIG   = "${WORKSPACE}/.docker"
  }

  stages {
    // Stage 1: Checkout the commit and extract the short 7-character Git commit SHA
    // The commit SHA serves as the immutable container image tag across Docker Hub and Kubernetes manifests
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
          currentBuild.displayName = "#${BUILD_NUMBER} ${env.GIT_SHA}"
        }
      }
    }

    // Stage 2: Run backend and frontend automated test suites in parallel
    // Fails fast if either suite breaks; generates LCOV coverage files used by SonarQube
    stage('Test') {
      parallel {
        stage('Backend tests')  { steps { dir('backend')  { sh 'npm ci && npm test' } } }
        stage('Frontend tests') { steps { dir('frontend') { sh 'npm ci && npm test' } } }
      }
    }

    // Stage 3: Execute SonarQube static analysis on the backend codebase
    // Waits for the SonarQube Quality Gate webhook callback and halts the build if code quality fails
    stage('SonarQube: backend') {
      steps {
        dir('backend') {
          withSonarQubeEnv('sonar') { sh "${tool 'sonar-scanner'}/bin/sonar-scanner" }
        }
        // SonarQube calls our webhook; stop the pipeline if the quality gate fails
        timeout(time: 5, unit: 'MINUTES') { waitForQualityGate abortPipeline: true }
      }
    }

    // Stage 4: Execute SonarQube static analysis on the frontend codebase
    // Waits for the SonarQube Quality Gate webhook callback and halts the build if code quality fails
    stage('SonarQube: frontend') {
      steps {
        dir('frontend') {
          withSonarQubeEnv('sonar') { sh "${tool 'sonar-scanner'}/bin/sonar-scanner" }
        }
        // SonarQube calls our webhook; stop the pipeline if the quality gate fails
        timeout(time: 5, unit: 'MINUTES') { waitForQualityGate abortPipeline: true }
      }
    }

    // Stage 5: Scan project filesystem, dependencies, and configuration files with Trivy
    // Audits package-lock.json and Dockerfiles for known vulnerabilities and hardcoded secrets
    stage('Trivy: source scan') {
      steps {
        // Full report (HIGH+CRITICAL) saved as artifact; --exit-code 1 fails pipeline on CRITICAL issues
        sh '''
          trivy fs --scanners vuln,secret,misconfig --skip-dirs "**/node_modules" \
            --severity HIGH,CRITICAL --no-progress --format table --output trivy-fs-report.txt .
          trivy fs --scanners vuln,secret,misconfig --skip-dirs "**/node_modules" \
            --severity CRITICAL --exit-code 1 --no-progress .
        '''
      }
    }

    // Stage 6: Build container images for both backend and frontend
    // Uses --pull to guarantee fresh base layers from the upstream registry, preventing stale base image CVEs
    stage('Docker build') {
      steps {
        sh '''
          docker build --pull -t ${BACKEND_IMAGE}:${GIT_SHA}  backend
          docker build --pull -t ${FRONTEND_IMAGE}:${GIT_SHA} frontend
        '''
      }
    }

    // Stage 7: Scan built container images for operating system and binary vulnerabilities
    // Uses --ignore-unfixed to focus on actionable CVEs; --exit-code 1 fails the pipeline on CRITICAL findings
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

    // Stage 8: Publish verified container images to Docker Hub
    // Uses DOCKER_CONFIG for isolated credentials; --password-stdin avoids leaking tokens into process tables
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

    // Stage 9: Promote deployment by committing updated image tags to the shopkart-gitops repository
    // Argo CD detects this Git change and automatically synchronizes the new images to the Amazon EKS cluster
    stage('Update GitOps repo') {
      steps {
        // Commit the new image tag to shopkart-gitops; Argo CD then rolls it out to EKS.
        // Jenkins never runs kubectl: Git is the only way to change the cluster.
        withCredentials([usernamePassword(credentialsId: env.GITHUB_CREDS,
                         usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
          sh '''
            rm -rf gitops
            git clone --depth 1 "https://${GH_USER}:${GH_TOKEN}@github.com/vkashsingh/shopkart-gitops.git" gitops
            cd gitops
            sed -i "s#image: ${BACKEND_IMAGE}:.*#image: ${BACKEND_IMAGE}:${GIT_SHA}#"  manifests/backend-deployment.yaml
            sed -i "s#image: ${FRONTEND_IMAGE}:.*#image: ${FRONTEND_IMAGE}:${GIT_SHA}#" manifests/frontend-deployment.yaml
            if git diff --quiet; then echo "Images already at ${GIT_SHA}, nothing to commit"; exit 0; fi
            git config user.name  "jenkins-ci"
            git config user.email "jenkins-ci@shopkart.local"
            git commit -am "ci: update images to ${GIT_SHA}"
            git push origin HEAD:main
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
      // deleteDir removes the entire workspace on the Jenkins master to free disk space and clean up credentials
      deleteDir()
    }
  }
}
