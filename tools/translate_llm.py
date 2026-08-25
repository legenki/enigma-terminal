#!/usr/bin/env python3
"""Automated translator for Enigma Terminal narrative files.

This script uses an LLM (like OpenAI) to translate the game's story, client 
profiles, and riddle templates into Spanish (es) and Portuguese (pt), while 
strictly preserving formatting and English cryptographic terms.

Requirements:
pip install openai
export OPENAI_API_KEY="your-key-here"
"""

import json
import os
import re
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Please install the OpenAI client: pip install openai")
    exit(1)

client = OpenAI()
ROOT = Path(__file__).resolve().parent.parent

SYSTEM_PROMPT = """You are a professional localizer for a cyberpunk/noir detective game.
Translate the text into {target_language}.

STRICT RULES:
1. Tone: Noir, gritty, cyberpunk, professional investigator.
2. DO NOT translate any text inside {curly_braces}. They are code placeholders.
3. DO NOT translate English BIP-39 words or prefixes if they are part of a puzzle. 
   Examples: "word begins with 'aban'" -> "la palabra comienza con 'aban'".
4. Maintain exact capitalization and line breaks.
5. If the input is a list of strings, return a JSON list of strings.
6. If the input is a single string, return the translated string.
7. Return ONLY valid JSON if the input is a JSON list. Return plain text if the input is plain text.
"""

def translate(content, target_language):
    is_list = isinstance(content, list)
    prompt = json.dumps(content, ensure_ascii=False) if is_list else content
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT.format(target_language=target_language)},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    
    result = response.choices[0].message.content.strip()
    if is_list:
        try:
            return json.loads(result)
        except:
            # Fallback simple array parse
            import ast
            return ast.literal_eval(result)
    return result

def process_dict(d, path=""):
    """Recursively search for dictionaries that have 'en' and 'ru' but lack 'es' or 'pt'."""
    if not isinstance(d, dict):
        return False
        
    modified = False
    
    # Specific case for clients.json forms (m/f)
    if 'm' in d and 'f' in d and isinstance(d['m'], str) and d['m'] == "":
        # We handle this manually or via a separate pass for grammar
        return False

    if 'en' in d and isinstance(d['en'], (str, list)) and 'ru' in d:
        # We found a localization bundle!
        if 'es' not in d or not d['es'] or (isinstance(d['es'], list) and not d['es'][0]):
            print(f"Translating to ES: {str(d['en'])[:50]}...")
            d['es'] = translate(d['en'], "Spanish")
            modified = True
            
        if 'pt' not in d or not d['pt'] or (isinstance(d['pt'], list) and not d['pt'][0]):
            print(f"Translating to PT: {str(d['en'])[:50]}...")
            d['pt'] = translate(d['en'], "Portuguese")
            modified = True

    # Recurse
    for k, v in d.items():
        if isinstance(v, dict):
            if process_dict(v, path + f".{k}"):
                modified = True
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    if process_dict(item, path + f".{k}[{i}]"):
                        modified = True
                        
    return modified

def translate_file(filepath):
    print(f"\nProcessing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    if process_dict(data):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Saved {filepath}")
    else:
        print("No missing translations found.")

if __name__ == "__main__":
    if not os.environ.get("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY is not set. The script will fail when making requests.")
        
    translate_file(ROOT / "data" / "cases.json")
    translate_file(ROOT / "data" / "clients.json")
    
    print("\nNote: tools/generate_cases.py contains dictionaries (DIALECT_PRIMER, ENTROPY_CLUES, etc.)")
    print("that should be translated manually or by extracting them to JSON first.")
    print("Then run `python3 tools/generate_cases.py` and `python3 tools/build_web_data.py` to rebuild.")

