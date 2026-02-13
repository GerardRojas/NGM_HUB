
path = r"c:\Users\germa\Desktop\NGM HUB WEB\.claude\modules_index.md"
with open(path, "w", encoding="utf-8") as f:
    f.write(open(r"c:\Users\germa\Desktop\NGM HUB WEB\.claude\_tmp_content.txt", "r", encoding="utf-8").read())
print("Done")
