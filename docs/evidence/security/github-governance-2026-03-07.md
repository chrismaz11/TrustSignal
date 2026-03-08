# GitHub Governance Evidence

- Generated: 2026-03-07T14:01:27Z
- Repository: `TrustSignal-dev/TrustSignal`
- Branch: `master`

## Auth Snapshot

```text
github.com
  ✓ Logged in to github.com account chrismaz11 (keyring)
  - Active account: true
  - Git operations protocol: ssh
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo'
```

## Branch Protection Snapshot

- protected: true
- required reviews: 1
- dismiss stale reviews: true
- require conversation resolution: true
- require signed commits: true
- enforce admins: true
- required status checks: lint, typecheck, test, rust-build

### Raw Branch JSON

```json
{
  "name": "master",
  "commit": {
    "sha": "331981ca8caa0997a981a453c5e7c5446b5240e1",
    "node_id": "C_kwDOQ4vhgNoAKDMzMTk4MWNhOGNhYTA5OTdhOTgxYTQ1M2M1ZTdjNTQ0NmI1MjQwZTE",
    "commit": {
      "author": {
        "name": "chrismaz11",
        "email": "chrismaz11@me.com",
        "date": "2026-03-07T04:34:31Z"
      },
      "committer": {
        "name": "chrismaz11",
        "email": "chrismaz11@me.com",
        "date": "2026-03-07T04:34:31Z"
      },
      "message": "docs: import passive inspector and operational training manuals",
      "tree": {
        "sha": "a25815eb26723f17132ada7917c20e97303c2783",
        "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/git/trees/a25815eb26723f17132ada7917c20e97303c2783"
      },
      "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/git/commits/331981ca8caa0997a981a453c5e7c5446b5240e1",
      "comment_count": 0,
      "verification": {
        "verified": false,
        "reason": "unsigned",
        "signature": null,
        "payload": null,
        "verified_at": null
      }
    },
    "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/commits/331981ca8caa0997a981a453c5e7c5446b5240e1",
    "html_url": "https://github.com/TrustSignal-dev/TrustSignal/commit/331981ca8caa0997a981a453c5e7c5446b5240e1",
    "comments_url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/commits/331981ca8caa0997a981a453c5e7c5446b5240e1/comments",
    "author": {
      "login": "chrismaz11",
      "id": 24700273,
      "node_id": "MDQ6VXNlcjI0NzAwMjcz",
      "avatar_url": "https://avatars.githubusercontent.com/u/24700273?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/chrismaz11",
      "html_url": "https://github.com/chrismaz11",
      "followers_url": "https://api.github.com/users/chrismaz11/followers",
      "following_url": "https://api.github.com/users/chrismaz11/following{/other_user}",
      "gists_url": "https://api.github.com/users/chrismaz11/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/chrismaz11/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/chrismaz11/subscriptions",
      "organizations_url": "https://api.github.com/users/chrismaz11/orgs",
      "repos_url": "https://api.github.com/users/chrismaz11/repos",
      "events_url": "https://api.github.com/users/chrismaz11/events{/privacy}",
      "received_events_url": "https://api.github.com/users/chrismaz11/received_events",
      "type": "User",
      "user_view_type": "public",
      "site_admin": false
    },
    "committer": {
      "login": "chrismaz11",
      "id": 24700273,
      "node_id": "MDQ6VXNlcjI0NzAwMjcz",
      "avatar_url": "https://avatars.githubusercontent.com/u/24700273?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/chrismaz11",
      "html_url": "https://github.com/chrismaz11",
      "followers_url": "https://api.github.com/users/chrismaz11/followers",
      "following_url": "https://api.github.com/users/chrismaz11/following{/other_user}",
      "gists_url": "https://api.github.com/users/chrismaz11/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/chrismaz11/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/chrismaz11/subscriptions",
      "organizations_url": "https://api.github.com/users/chrismaz11/orgs",
      "repos_url": "https://api.github.com/users/chrismaz11/repos",
      "events_url": "https://api.github.com/users/chrismaz11/events{/privacy}",
      "received_events_url": "https://api.github.com/users/chrismaz11/received_events",
      "type": "User",
      "user_view_type": "public",
      "site_admin": false
    },
    "parents": [
      {
        "sha": "f12f6c770831cbf5d8da2a08cda45ad195a10c9d",
        "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/commits/f12f6c770831cbf5d8da2a08cda45ad195a10c9d",
        "html_url": "https://github.com/TrustSignal-dev/TrustSignal/commit/f12f6c770831cbf5d8da2a08cda45ad195a10c9d"
      }
    ]
  },
  "_links": {
    "self": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master",
    "html": "https://github.com/TrustSignal-dev/TrustSignal/tree/master"
  },
  "protected": true,
  "protection": {
    "enabled": true,
    "required_status_checks": {
      "enforcement_level": "everyone",
      "contexts": [
        "lint",
        "typecheck",
        "test",
        "rust-build"
      ],
      "checks": [
        {
          "context": "lint",
          "app_id": 15368
        },
        {
          "context": "typecheck",
          "app_id": 15368
        },
        {
          "context": "test",
          "app_id": 15368
        },
        {
          "context": "rust-build",
          "app_id": 15368
        }
      ]
    }
  },
  "protection_url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection"
}
```

### Raw Protection JSON

```json
{
  "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection",
  "required_status_checks": {
    "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection/required_status_checks",
    "strict": true,
    "contexts": [
      "lint",
      "typecheck",
      "test",
      "rust-build"
    ],
    "contexts_url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection/required_status_checks/contexts",
    "checks": [
      {
        "context": "lint",
        "app_id": 15368
      },
      {
        "context": "typecheck",
        "app_id": 15368
      },
      {
        "context": "test",
        "app_id": 15368
      },
      {
        "context": "rust-build",
        "app_id": 15368
      }
    ]
  },
  "required_pull_request_reviews": {
    "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection/required_pull_request_reviews",
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 1
  },
  "required_signatures": {
    "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection/required_signatures",
    "enabled": true
  },
  "enforce_admins": {
    "url": "https://api.github.com/repos/TrustSignal-dev/TrustSignal/branches/master/protection/enforce_admins",
    "enabled": true
  },
  "required_linear_history": {
    "enabled": false
  },
  "allow_force_pushes": {
    "enabled": false
  },
  "allow_deletions": {
    "enabled": false
  },
  "block_creations": {
    "enabled": false
  },
  "required_conversation_resolution": {
    "enabled": true
  },
  "lock_branch": {
    "enabled": false
  },
  "allow_fork_syncing": {
    "enabled": false
  }
}
```

## Repo Security and Analysis

```json
{
  "dependabot_security_updates": {
    "status": "enabled"
  },
  "secret_scanning": {
    "status": "enabled"
  },
  "secret_scanning_non_provider_patterns": {
    "status": "disabled"
  },
  "secret_scanning_push_protection": {
    "status": "enabled"
  },
  "secret_scanning_validity_checks": {
    "status": "disabled"
  }
}
```

## Interpretation

- Use this file as dated evidence for branch protection and security-analysis settings.
- If branch protection fields are `n/a`, verify branch name and permissions.
