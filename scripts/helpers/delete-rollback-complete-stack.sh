#!/usr/bin/env bash
set -euo pipefail

STACK_NAME=${1:-}

if [[ -z "$STACK_NAME" ]]; then
  echo "Usage: $0 <stack-name>" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI must be available to delete rollback-complete stacks." >&2
  exit 1
fi

status=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || true)

if [[ -z "$status" || "$status" == "None" ]]; then
  echo "Stack $STACK_NAME does not exist; nothing to clean up."
  exit 0
fi

case "$status" in
  ROLLBACK_COMPLETE)
    echo "Stack $STACK_NAME is in ROLLBACK_COMPLETE. Deleting so it can be recreated..."
    aws cloudformation delete-stack --stack-name "$STACK_NAME"
    echo "Waiting for stack deletion to finish..."
    if aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"; then
      echo "Stack $STACK_NAME deleted."
    else
      echo "Stack $STACK_NAME deletion failed; please investigate in the AWS console." >&2
      exit 1
    fi
    ;;
  *)
    echo "Stack $STACK_NAME status is $status; no deletion required."
    ;;
fi
