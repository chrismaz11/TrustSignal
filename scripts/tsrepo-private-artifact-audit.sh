#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/Users/christopher/Projects/TSREPO}"

match_paths_regex='(^docs/compliance/kpmg-|^docs/evidence/|(^|/)audit-output/|(^|/)kpmg-[^/]+)'
find_repos() {
  find "$ROOT" -maxdepth 2 -name .git -type d | sed 's#/.git##' | sort
}

remote_refs() {
  git -C "$1" for-each-ref --format='%(refname:short)' refs/remotes/origin 2>/dev/null || true
}

echo "| Repo | Branch | HEAD path matches | History path matches | Origin path matches | HEAD content refs | Recommendation |"
echo "| --- | --- | ---: | ---: | ---: | ---: | --- |"

while IFS= read -r repo; do
  branch="$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  head_paths="$(git -C "$repo" ls-files | rg "$match_paths_regex" || true)"
  history_paths="$(git -C "$repo" log --all --name-only --pretty=format: | sort -u | rg "$match_paths_regex" || true)"

  origin_matches=""
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    ref_matches="$(git -C "$repo" log "$ref" --name-only --pretty=format: 2>/dev/null | sort -u | rg "$match_paths_regex" || true)"
    if [[ -n "$ref_matches" ]]; then
      origin_matches+="$ref_matches"$'\n'
    fi
  done < <(remote_refs "$repo")
  origin_matches="$(printf '%s\n' "$origin_matches" | sed '/^$/d' | sort -u || true)"

  head_content_refs="$(
    {
      git -C "$repo" grep -nF '/tmp/kpmg-' -- . 2>/dev/null || true
      git -C "$repo" grep -nF 'kpmg-readiness-' -- . 2>/dev/null || true
    } | rg -v '^\.githooks/pre-commit:' | sort -u || true
  )"

  head_count="$(printf '%s\n' "$head_paths" | sed '/^$/d' | wc -l | tr -d ' ')"
  history_count="$(printf '%s\n' "$history_paths" | sed '/^$/d' | wc -l | tr -d ' ')"
  origin_count="$(printf '%s\n' "$origin_matches" | sed '/^$/d' | wc -l | tr -d ' ')"
  content_count="$(printf '%s\n' "$head_content_refs" | sed '/^$/d' | wc -l | tr -d ' ')"

  recommendation="none"
  if [[ "$origin_count" -gt 0 ]]; then
    recommendation="history-review candidate"
  elif [[ "$head_count" -gt 0 || "$content_count" -gt 0 ]]; then
    recommendation="HEAD-only cleanup candidate"
  fi

  echo "| $repo | $branch | $head_count | $history_count | $origin_count | $content_count | $recommendation |"
done < <(find_repos)

echo
echo "Detailed findings:"

while IFS= read -r repo; do
  echo
  echo "## $repo"
  echo
  echo "- Branch: $(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

  head_paths="$(git -C "$repo" ls-files | rg "$match_paths_regex" || true)"
  history_paths="$(git -C "$repo" log --all --name-only --pretty=format: | sort -u | rg "$match_paths_regex" || true)"
  head_content_refs="$(
    {
      git -C "$repo" grep -nF '/tmp/kpmg-' -- . 2>/dev/null || true
      git -C "$repo" grep -nF 'kpmg-readiness-' -- . 2>/dev/null || true
    } | rg -v '^\.githooks/pre-commit:' | sort -u || true
  )"

  echo "- HEAD path matches:"
  if [[ -n "$head_paths" ]]; then
    printf '  - %s\n' $head_paths
  else
    echo "  - none"
  fi

  echo "- History path matches:"
  if [[ -n "$history_paths" ]]; then
    printf '  - %s\n' $history_paths
  else
    echo "  - none"
  fi

  echo "- HEAD content references to blocked tmp/KPMG markers:"
  if [[ -n "$head_content_refs" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      echo "  - $line"
    done <<< "$head_content_refs"
  else
    echo "  - none"
  fi
done < <(find_repos)
