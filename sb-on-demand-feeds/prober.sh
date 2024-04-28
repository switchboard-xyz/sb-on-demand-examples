docker buildx build -f ./Dockerfile -t switchboardlabs/pull-probe:v0.0.2 --platform linux/amd64,linux/arm64 --pull  ./ --push

