with open('docs/js/gui/app.js', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("search: () => this.buildSearch(),", "archive: () => this.buildArchive(),")

with open('docs/js/gui/app.js', 'w', encoding='utf-8') as f:
    f.write(code)
