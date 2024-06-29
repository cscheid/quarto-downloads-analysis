#!/usr/bin/env bash

OWNER=quarto-dev
REPO=quarto-cli

gh api graphql --paginate -F owner=${OWNER} -F name=$REPO -f query='
  query($name: String!, $owner: String!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      releases(first: 100, after: $endCursor) { nodes { 
        tagName
        updatedAt
        releaseAssets(first: 100) {
            nodes {
                downloadCount
                name
            } 
        }
      } }
    }
  }
' > quarto-cli-releases.json