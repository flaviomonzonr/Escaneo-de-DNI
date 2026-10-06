with open("../backend/extractors/dni_extractor.py", "r", encoding="utf-8") as f:
    code = f.read()

# Let's inspect the exact lines to replace for SURNAMES & NAMES and ADDRESS
print("Original code length:", len(code))
