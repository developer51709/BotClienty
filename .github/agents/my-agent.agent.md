---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: MultiAgent
description: Chooses from different agents
---

# BotClienty Agent System

This repository uses a multi-agent system to handle different types of development tasks efficiently.

## Available Agents

### 🚀 Speed Agent
- **Best for**: Quick fixes, simple changes
- **Speed**: Very Fast
- **See**: [speed-agent.md](./speed-agent.md)

### ⚖️ Balanced Agent
- **Best for**: Feature development, moderate complexity tasks
- **Speed**: Fast
- **See**: [balanced-agent.md](./balanced-agent.md)

### 🧠 Complex Agent
- **Best for**: Architectural changes, system-wide refactoring
- **Speed**: Slower (higher quality)
- **See**: [complex-agent.md](./complex-agent.md)

## Choosing the Right Agent

### Use Speed Agent when:
- Fixing typos or simple bugs
- Updating configuration
- Making small UI tweaks
- Quick documentation updates

### Use Balanced Agent when:
- Adding new features
- Writing tests
- Refactoring modules
- API integrations
- Code reviews

### Use Complex Agent when:
- Redesigning architecture
- Major refactoring across multiple files
- Security audits
- Performance optimization
- Complex feature implementation

## Agent Comparison

| Feature | Speed | Balanced | Complex |
|---------|-------|----------|---------|
| Response Time | ⚡⚡⚡ | ⚡⚡ | ⚡ |
| Context Window | Small | Medium | Large |
| Code Complexity | Basic | Moderate | Advanced |
| Multi-file Changes | ❌ | ✅ | ✅✅ |
| Architectural Insight | Limited | Good | Excellent |
| Cost Efficiency | Highest | Medium | Lowest |

## How to Use

When requesting help or changes, specify which agent should handle the task:

```
@speed-agent: Fix the typo in the login button
@balanced-agent: Add pagination to the message list
@complex-agent: Redesign the caching system for better performance
```

If no agent is specified, the system will automatically choose based on the complexity of the request.

## Notes

- **Speed Agent**: Optimized for development velocity
- **Balanced Agent**: Best for day-to-day development  
- **Complex Agent**: Use sparingly for high-impact changes

---

*This agent system ensures optimal resource usage while maintaining high code quality.*
