# REF: http://postd.cc/auto-documented-makefile/
.DEFAULT_GOAL := help
.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

fetch: ## Fetch depend libs from internet
	curl -L https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js > underscore-min.js
	curl -L https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.5/handlebars.min.js > handlebars.min.js
	curl -L https://cdnjs.cloudflare.com/ajax/libs/marked/0.3.5/marked.min.js > marked.min.js
