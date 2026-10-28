#!/bin/bash
# usage: gen.sh cat startnum count file
export PATH=$HOME/.local/bin:/opt/homebrew/bin:$PATH
cd ~/biz-english-4000
claude -p "Read SPEC.md. Create file data/$4.json: a JSON array of exactly $3 NEW entries for category '$1', ids from prefix number $2 upward (4 digits). Cover distinct subtopics; avoid words already present in any existing data/*.json file (check them). High quality Traditional Chinese. Write the file with the Write tool, then validate with: python3 -c \"import json;print(len(json.load(open('data/$4.json'))))\". Fix until count is exactly $3 and valid." --model claude-sonnet-5-5 --effort medium --permission-mode acceptEdits --allowedTools "Bash(python3 *)" "Bash(ls *)" "Bash(cat *)" > logs/$4.log 2>&1
