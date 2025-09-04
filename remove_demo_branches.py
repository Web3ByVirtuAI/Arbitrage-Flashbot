#!/usr/bin/env python3

import re

def remove_demo_branches(content):
    # Pattern to match: if (false) { ... } else { ... }
    # This will capture the entire if-else block and replace it with just the else content
    pattern = r'if \(false\) \{[^{}]*(?:\{[^{}]*\}[^{}]*)*\} else \{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}'
    
    def replace_func(match):
        else_content = match.group(1).strip()
        return else_content
    
    # Apply the pattern multiple times to handle nested cases
    prev_content = ""
    while prev_content != content:
        prev_content = content
        content = re.sub(pattern, replace_func, content, flags=re.DOTALL)
    
    # Also remove standalone if (false) blocks without else
    standalone_pattern = r'if \(false\) \{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    content = re.sub(standalone_pattern, '', content, flags=re.DOTALL)
    
    return content

# Read the file
with open('/home/user/webapp/src/api/server.ts', 'r') as f:
    content = f.read()

# Remove demo branches
cleaned_content = remove_demo_branches(content)

# Write back
with open('/home/user/webapp/src/api/server.ts', 'w') as f:
    f.write(cleaned_content)

print("Demo branches removed successfully")