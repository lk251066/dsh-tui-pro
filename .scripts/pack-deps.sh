#!/bin/bash
# Pack all TUI peerDependencies from the main harness monorepo

cd D:/jyrh/jyrh/deepseekharness

packages=(
  "@deepseek-ai/cordis"
  "@deepseek-ai/dsh-agent"
  "@deepseek-ai/dsh-agent-loop"
  "@deepseek-ai/dsh-commands"
  "@deepseek-ai/dsh-compaction"
  "@deepseek-ai/dsh-goal"
  "@deepseek-ai/dsh-invariants"
  "@deepseek-ai/dsh-llm"
  "@deepseek-ai/dsh-llm-retry"
  "@deepseek-ai/dsh-memory"
  "@deepseek-ai/dsh-permission-presets"
  "@deepseek-ai/dsh-plan-mode"
  "@deepseek-ai/dsh-session"
  "@deepseek-ai/dsh-session-persistence"
  "@deepseek-ai/dsh-session-projection"
  "@deepseek-ai/dsh-session-projection-cache"
  "@deepseek-ai/dsh-session-query"
  "@deepseek-ai/dsh-session-reference"
  "@deepseek-ai/dsh-session-stats"
  "@deepseek-ai/dsh-session-title"
  "@deepseek-ai/dsh-skill"
  "@deepseek-ai/dsh-storage"
  "@deepseek-ai/dsh-storage-domain"
  "@deepseek-ai/dsh-storage-json"
  "@deepseek-ai/dsh-subprocess"
  "@deepseek-ai/dsh-system-prompt"
  "@deepseek-ai/dsh-tmux-context"
  "@deepseek-ai/dsh-token-meter"
  "@deepseek-ai/dsh-tool-ask-user"
  "@deepseek-ai/dsh-tools"
  "@deepseek-ai/dsh-user-approval"
  "@deepseek-ai/dsh-user-questions"
)

echo "Packing ${#packages[@]} packages..."

for pkg in "${packages[@]}"; do
  echo "Packing $pkg..."
  pnpm --filter "$pkg" pack --pack-destination ../dsh-tui-pro/.tarballs 2>&1 | grep -v "WARN"
done

echo "Done! Tarballs saved to ../dsh-tui-pro/.tarballs"
