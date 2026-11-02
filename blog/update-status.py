#!/usr/bin/env python3
import os
import yaml

def update_frontmatter(path):
  """Updates the YAML frontmatter of a markdown file or adds one if it
  doesn't exist. If the path points to a directory, it searches for a file
  named 'index.md' and updates its frontmatter.

  Args:
    path: The path to the markdown file or directory.
  """

  if os.path.isfile(path) and path.endswith(".md"):
    with open(path, "r") as f:
      content = f.read()
      try:
        # Separate the frontmatter from the content
        delimiter_index = content.find("---\n") + 4
        frontmatter_yaml = content[:delimiter_index]
        print(frontmatter_yaml)
        content = content[delimiter_index:]
        # Parse the frontmatter from YAML
        frontmatter = yaml.safe_load(frontmatter_yaml)
      except yaml.YAMLError:
        # If there is no YAML frontmatter, create an empty dictionary
        frontmatter = {}
      # Update the status property to 'draft'
      frontmatter["status"] = "draft"
      # Combine the updated frontmatter with the content
      updated_content = yaml.dump(frontmatter, Dumper=yaml.SafeDumper) + content
      # Write the updated content back to the file
      with open(path, "w") as f:
        f.write(updated_content)
  elif os.path.isdir(path):
    index_path = os.path.join(path, "index.md")
    if os.path.isfile(index_path):
      update_frontmatter(index_path)
    else:
      # Create an index.md file with the desired frontmatter
      with open(index_path, "w") as f:
        f.write("---\nstatus: draft\n---\n")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Process a folder or a YAML file.")
    parser.add_argument("path", 
                        help="Path to the folder or YAML file.")
    args = parser.parse_args()

    update_frontmatter(args.path)
