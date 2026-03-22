REPO := co42/garmin-dashboard
VERSION ?= $(shell node -p "require('./package.json').version")

.PHONY: dev build check release clean

dev:
	npm run dev

build:
	npm run build

check:
	npx svelte-kit sync
	npx svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
	npm run build

# Tag, push, and wait for GitHub Actions to build Docker image
# Usage: make release VERSION=1.0.0
release:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make release VERSION=x.y.z"; exit 1; fi
	@if git rev-parse "v$(VERSION)" >/dev/null 2>&1; then echo "Tag v$(VERSION) already exists"; exit 1; fi
	@echo "=== Releasing v$(VERSION) ==="
	@npm version $(VERSION) --no-git-tag-version
	@git add -A
	@git commit -m "chore: release v$(VERSION)" || true
	@git tag "v$(VERSION)"
	@git push && git push --tags
	@echo ""
	@echo "=== Waiting for GitHub Actions to build Docker image ==="
	@sleep 10
	@RUN_ID=$$(gh run list -R $(REPO) --branch v$(VERSION) --limit 1 --json databaseId -q '.[0].databaseId') && \
		echo "Watching workflow run $$RUN_ID..." && \
		gh run watch $$RUN_ID -R $(REPO) --exit-status || (echo "Release build failed!" && exit 1)
	@echo ""
	@echo "=== Release v$(VERSION) complete! ==="
	@echo "  Docker: ghcr.io/$(REPO):$(VERSION)"

clean:
	rm -rf build node_modules .svelte-kit
