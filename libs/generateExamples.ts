import fs from "fs/promises";
import { fromMarkdown } from "mdast-util-from-markdown";
import { Code, Heading } from "mdast-util-from-markdown/lib";
import { toMarkdown } from "mdast-util-to-markdown";
import { FunctionExampleRecord } from "./types";

export async function generateExamples(moduleMarkdownPath: string, functionExamplesRecord: FunctionExampleRecord, packageName: string) {
  const moduleMarkdownContent = await fs.readFile(moduleMarkdownPath, "utf-8");
  const markdownTree = fromMarkdown(moduleMarkdownContent);

  const slugHeader = markdownTree.children[1];
  let slug: string = "";
  if (slugHeader.type === "heading" && slugHeader.depth === 2) {
    if (slugHeader.children[0].type === "text")
      slug = slugHeader.children[0].value
  }
  // Skip the first 2 nodes as they contain the md slug
  for (let index = 2; index < markdownTree.children.length; index++) {
    const markdownTreeChildren = markdownTree.children[index];
    // Only h3 are used as function headings
    if (markdownTreeChildren.type === "heading" && markdownTreeChildren.depth === 3) {
      const [textChildNode] = markdownTreeChildren.children;
      // Make sure the function has an example in the record
      if (textChildNode.type === "text" && functionExamplesRecord[textChildNode.value]) {
        const {code, output} = functionExamplesRecord[textChildNode.value];
        // Move to the defined in header
        for (let innerIndex = index + 1;; innerIndex++) {
          const childNode = markdownTree.children[innerIndex];
          // Find the ### Returns node
          if (childNode?.type === "heading" && childNode.depth === 4) {
            if (childNode.children[0]?.type === "text" && childNode.children[0].value === "Defined in") {
              const codeUsageNode: Code = {
                type: "code",
                value: `import { ${textChildNode.value} } from "${packageName}";\n\n${code};`,
                lang: "ts",
              }, 
              // Only create node if output is not empty
              codeResultNode: Code | null = output ? {
                type: "code",
                value: output,
                lang: "json"
              } : null, headerNode: Heading = {
                depth: 4,
                type: "heading",
                children: [
                  {
                    type: "text",
                    value: "Example"
                  }
                ]
              }

              // Adding new nodes from bottom up
              // Only add node if its not null
              if (codeResultNode) {
                markdownTree.children.splice(innerIndex, 0, codeResultNode);
              }
              markdownTree.children.splice(innerIndex, 0, codeUsageNode);
              markdownTree.children.splice(innerIndex, 0, headerNode);
              // Set the index, to skip the visited nodes, along with the inserted ones
              index = innerIndex + (codeResultNode ? 3 : 2);
              break;
            }
            // Remove the previous examples
            else if (childNode.children[0]?.type === "text" && childNode.children[0].value === "Example") {
              // Some example might not have output, so check if the 3rd node is code and json
              if (markdownTree.children[innerIndex + 2].type === "code" && (markdownTree.children[innerIndex + 2] as Code).lang === "json") {
                markdownTree.children.splice(innerIndex, 3);
              } else {
                markdownTree.children.splice(innerIndex, 2);
              }
              innerIndex-=1;
            }
          } 
        }
      }
    }
  }
  // Add the slug with the transformed markdown tree
  await fs.writeFile(moduleMarkdownPath, `---\n${slug}\n---\n` + toMarkdown({
    type: "root",
    children: markdownTree.children.slice(2)
  }, {
    rule: "_"
  }), "utf-8")
}