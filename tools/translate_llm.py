#!/usr/bin/env python3
"""Automated translator for Enigma Terminal narrative files using Gemini.

This script uses Google's Gemini API to translate the game's story, client 
profiles, and riddle templates into Spanish (es) and Portuguese (pt).
It respects the 15 RPM (Requests Per Minute) rate limit by waiting between calls.

Requirements:
pip install google-generativeai
export GEMINI_API_KEY="your-key-here"
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    import google.generativeai as genai
except ImportError:
    print("Please install the Gemini client: pip install google-generativeai")
    sys.exit(1)

# Configure API key
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("\n[!] ОШИБКА: Ключ API не найден!")
    print("Пожалуйста, выполните команду перед запуском скрипта:")
    print("export GEMINI_API_KEY='ваш_ключ_от_gemini'")
    sys.exit(1)

genai.configure(api_key=api_key)
# The model name from your dashboard
MODEL_NAME = "gemini-3.1-flash-lite"
# (If the API throws a "model not found" error, you can change this to "gemini-1.5-flash" or "gemini-2.5-flash")

ROOT = Path(__file__).resolve().parent.parent

SYSTEM_PROMPT = """You are a professional localizer for a cyberpunk/noir detective game.
Translate the text into {target_language}.

STRICT RULES:
1. Tone: Noir, gritty, cyberpunk, professional investigator.
2. DO NOT translate any text inside {{curly_braces}}. They are code placeholders.
3. DO NOT translate English BIP-39 words or prefixes if they are part of a puzzle. 
   Examples: "word begins with 'aban'" -> "la palabra comienza con 'aban'".
4. Maintain exact capitalization and line breaks.
5. If the input is a list of strings, return ONLY a valid JSON list of strings.
6. If the input is a single string, return ONLY the translated string.
7. Return raw text only! Do NOT wrap in ```json or ``` markdown blocks.
"""

def translate(content, target_language):
    is_list = isinstance(content, list)
    prompt = json.dumps(content, ensure_ascii=False) if is_list else content
    
    # We combine system instructions into the prompt for maximum compatibility with all Gemini SDK versions
    full_prompt = SYSTEM_PROMPT.format(target_language=target_language) + "\n\nTEXT TO TRANSLATE:\n" + prompt
    
    model = genai.GenerativeModel(MODEL_NAME)
    
    max_retries = 4
    for attempt in range(max_retries):
        try:
            # RATE LIMIT PROTECTION: 15 RPM = 1 request every 4 seconds.
            # We wait 4.5 seconds to be perfectly safe.
            print("  [Waiting 4.5s to respect 15 RPM limit...]")
            time.sleep(4.5)
            
            response = model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                )
            )
            
            result = response.text.strip()
            
            # Strip markdown formatting just in case Gemini ignored rule #7
            if result.startswith("```"):
                result = result.split("\n", 1)[-1] if "\n" in result else result[3:]
                if result.rstrip().endswith("```"):
                    result = result.rstrip()[:-3]
                result = result.strip()

            if is_list:
                try:
                    parsed = json.loads(result)
                except Exception:
                    import ast
                    parsed = ast.literal_eval(result)
                if not isinstance(parsed, list) or len(parsed) != len(content):
                    raise ValueError(
                        f"expected a list of {len(content)}, got {parsed!r}"
                    )
                return parsed
            return result

        except Exception as e:
            print(f"  [Error]: {e}")
            if attempt < max_retries - 1:
                wait_time = 15 * (attempt + 1)
                print(f"  [Retrying in {wait_time}s...]")
                time.sleep(wait_time)
            else:
                print("  [Failed after retries].")
                raise

def process_dict(d, path=""):
    """Recursively search for dictionaries that have 'en' and 'ru' but lack 'es' or 'pt'."""
    if not isinstance(d, dict):
        return False
        
    modified = False
    
    # Gendered adjective forms ({"m": ..., "f": ...}) and the *_gender lists
    # beside them are not free translation: a wrong gender reads as broken
    # grammar in every codename built from it. They are maintained by hand in
    # data/clients.json, so this script leaves them alone — but it refuses to
    # pretend they are done when they are empty.
    if 'm' in d and 'f' in d and isinstance(d.get('m'), str):
        if not d['m'] or not d['f']:
            raise SystemExit(
                "data/clients.json still has empty gendered forms; fill "
                "es_forms/pt_forms and es_gender/pt_gender by hand first."
            )
        return False

    if 'en' in d and isinstance(d['en'], (str, list)) and 'ru' in d:
        if 'es' not in d or not d['es'] or (isinstance(d['es'], list) and not d['es'][0]):
            preview = str(d['en'])[:40].replace('\n', ' ')
            print(f"Translating to ES: {preview}...")
            d['es'] = translate(d['en'], "Spanish")
            modified = True
            with open(current_filepath, 'w', encoding='utf-8') as f:
                json.dump(global_data, f, ensure_ascii=False, indent=2)
            
        if 'pt' not in d or not d['pt'] or (isinstance(d['pt'], list) and not d['pt'][0]):
            preview = str(d['en'])[:40].replace('\n', ' ')
            print(f"Translating to PT: {preview}...")
            d['pt'] = translate(d['en'], "Portuguese")
            modified = True
            with open(current_filepath, 'w', encoding='utf-8') as f:
                json.dump(global_data, f, ensure_ascii=False, indent=2)

    for k, v in d.items():
        if isinstance(v, dict):
            if process_dict(v, path + f".{k}"):
                modified = True
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict) and process_dict(item, path + f".{k}[{i}]"):
                    modified = True
    return modified

def translate_file(filepath):
    print(f"\nProcessing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        global global_data, current_filepath
        global_data = json.load(f)
        current_filepath = filepath
        
    if process_dict(global_data):
        print(f"Finished {filepath}")
    else:
        print("No missing translations found.")
if __name__ == "__main__":
    translate_file(ROOT / "data" / "cases.json")
    translate_file(ROOT / "data" / "clients.json")
    
    print("\nNote: tools/generate_cases.py contains a few dictionaries.")
    print("Run `python3 tools/generate_cases.py` and `python3 tools/build_web_data.py` to rebuild after translation.")
