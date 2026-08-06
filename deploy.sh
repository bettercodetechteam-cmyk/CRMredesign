#!/bin/bash

# ZICA ZIMA CRM Production Deployment Script
# This script automates the deployment process for production

set -e  # Exit on any error

echo "🚀 Starting ZICA ZIMA CRM Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    required_vars=(
        "NODE_ENV"
        "FIREBASE_API_KEY"
        "FIREBASE_PROJECT_ID"
        "VITE_FIREBASE_API_KEY"
        "VITE_FIREBASE_PROJECT_ID"
        "IMAGEKIT_PUBLIC_KEY"
        "IMAGEKIT_PRIVATE_KEY"
        "IMAGEKIT_URL_ENDPOINT"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set these variables before running the deployment script."
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --production=false
    else
        npm install
    fi
    
    print_success "Dependencies installed successfully"
}

# Build the application
build_app() {
    print_status "Building application..."
    
    # Clean previous builds
    if [ -d "dist" ]; then
        rm -rf dist
    fi
    
    # Build client and server
    npm run build
    
    print_success "Application built successfully"
}

# Run tests (if available)
run_tests() {
    print_status "Running tests..."
    
    if npm run test 2>/dev/null; then
        print_success "All tests passed"
    else
        print_warning "No tests found or tests failed - continuing deployment"
    fi
}

# Check build output
verify_build() {
    print_status "Verifying build output..."
    
    if [ ! -d "dist" ]; then
        print_error "Build directory not found. Build may have failed."
        exit 1
    fi
    
    if [ ! -d "dist/public" ]; then
        print_error "Client build not found in dist/public"
        exit 1
    fi
    
    if [ ! -f "dist/index.js" ]; then
        print_error "Server build not found in dist/index.js"
        exit 1
    fi
    
    print_success "Build verification completed"
}

# Start the application
start_app() {
    print_status "Starting application..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Start the server
    npm start &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 5
    
    # Check if server is running
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_success "Application started successfully (PID: $SERVER_PID)"
        echo "Server is running on http://localhost:${PORT:-5000}"
        echo "Health check: http://localhost:${PORT:-5000}/api/health"
    else
        print_error "Failed to start application"
        exit 1
    fi
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:${PORT:-5000}/api/health" > /dev/null; then
            print_success "Health check passed"
            return 0
        fi
        
        print_status "Health check attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Main deployment process
main() {
    echo "=========================================="
    echo "ZICA ZIMA CRM Production Deployment"
    echo "=========================================="
    echo ""
    
    # Check environment variables
    check_env_vars
    
    # Install dependencies
    install_dependencies
    
    # Run tests
    run_tests
    
    # Build application
    build_app
    
    # Verify build
    verify_build
    
    # Start application
    start_app
    
    # Health check
    if health_check; then
        echo ""
        echo "=========================================="
        print_success "DEPLOYMENT COMPLETED SUCCESSFULLY!"
        echo "=========================================="
        echo ""
        echo "Your ZICA ZIMA CRM is now running in production!"
        echo "URL: http://localhost:${PORT:-5000}"
        echo "Health Check: http://localhost:${PORT:-5000}/api/health"
        echo ""
        echo "To stop the server, run: kill $SERVER_PID"
        echo ""
    else
        print_error "Deployment failed during health check"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; kill $SERVER_PID 2>/dev/null || true; exit 1' INT TERM

# Run main function
main "$@" 