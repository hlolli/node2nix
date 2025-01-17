import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "../wasm/tree-sitter.cjs";
import * as R from "rambda";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function treeToJson(treeCursor, context = { out: {} }, treePath = []) {
  const {
    nodeType,
    nodeText,
    nodeIsNamed,
    startPosition,
    endPosition,
    startIndex,
    endIndex,
  } = treeCursor;

  // console.log({
  //   treePath,
  //   nodeType,
  //   nodeText,
  //   nodeIsNamed,
  //   startPosition,
  //   endPosition,
  //   startIndex,
  //   endIndex,
  // });

  switch (nodeType) {
    case "ERROR": {
      throw new SyntaxError(treeCursor.nodeText + "\n");
      process.exit(1);
      break;
    }
    case "source_expression":
    case "select":
    case "attrset": {
      if (treeCursor.gotoFirstChild()) {
        return treeToJson(treeCursor, context, treePath);
      }
      break;
    }

    case "app":
    case "function":
    case ";": {
      if (treeCursor.gotoParent() && treeCursor.gotoNextSibling()) {
        return treeToJson(treeCursor, context, R.dropLast(1, treePath));
      }
      // if (treeCursor.gotoNextSibling()) {
      //   return treeToJson(treeCursor, context, treePath);
      // } else
      break;
    }
    case "}": {
      if (treeCursor.gotoParent() && treeCursor.gotoNextSibling()) {
        return treeToJson(treeCursor, context, treePath);
      }
      break;
    }

    case "comment":
    case "formals":
    case ":":
    case "{": {
      if (treeCursor.gotoNextSibling()) {
        return treeToJson(treeCursor, context, treePath);
      }
      break;
    }
    case "bind": {
      const ctx = R.pipe(R.assoc("isBinding", true))(context);
      if (treeCursor.gotoFirstChild()) {
        return treeToJson(treeCursor, ctx, treePath);
      }
      break;
    }
    case "attrpath": {
      if (treeCursor.nodeText === "packageDerivation") {
        if (treeCursor.gotoParent() && treeCursor.gotoNextSibling()) {
          return treeToJson(treeCursor, context, R.dropLast(1, treePath));
        }
      }
      const tp = R.pipe(
        R.when(
          () => context.isBinding,
          (c) => R.append((treeCursor.nodeText || "").replace(/"/g, ""), c)
        )
      )(treePath);
      const ctx = R.pipe(R.assoc("isBinding", false))(context);
      if (treeCursor.gotoNextSibling()) {
        return treeToJson(treeCursor, ctx, tp);
      }
      break;
    }
    case "string":
    case "indented_string": {
      const tp = R.pipe(
        R.when(
          () => context.isBinding,
          (c) => R.append(JSON.parse(treeCursor.nodeText), c)
        )
      )(treePath);
      const ctx = R.pipe(
        R.when(R.prop("isAssigning"), (c) =>
          R.assocPath(
            ["out"].concat(tp),
            nodeType === "indented_string"
              ? treeCursor.nodeText.replace("''", "")
              : JSON.parse(treeCursor.nodeText),
            c
          )
        ),
        R.assoc("isBinding", false),
        R.assoc("isAssigning", false)
      )(context);
      if (treeCursor.gotoNextSibling()) {
        return treeToJson(treeCursor, ctx, tp);
      }
      break;
    }
    case "=": {
      const ctx = R.pipe(
        R.assoc("isBinding", false),
        R.assoc("isAssigning", true)
      )(context);

      if (treeCursor.gotoNextSibling()) {
        return treeToJson(treeCursor, ctx, treePath);
      }
      break;
    }
  }

  return context.out;
}

async function initParser() {
  await Parser.init();
  const parser = new Parser();
  const Nix = await Parser.Language.load(
    path.resolve(__dirname, "../wasm/tree-sitter-nix.wasm")
  );
  parser.setLanguage(Nix);
  return parser;
}

export async function fromFile(userPath) {
  let parser;
  try {
    parser = await initParser();
  } catch (error) {
    console.error("Error while initializing wasm", error);
    process.exit(1);
  }
  const srcPath = userPath || path.resolve("./package.nix");
  if (!fs.existsSync(srcPath)) {
    throw new Error(`File not found ${srcPath.toString()}`);
    process.exit(1);
  }
  const src = fs.readFileSync(srcPath).toString();
  const tree = parser.parse(src);
  const json = treeToJson(tree.rootNode.walk());
  // console.log(json);
  return json;
}

// Parser.init().then(async () => {
//   const parser = new Parser();
//   const Nix = await Parser.Language.load("./wasm/tree-sitter-nix.wasm");
//   parser.setLanguage(Nix);
//   const r = fs.readFileSync("./testx/package.nix").toString();
//   const tree = parser.parse(r);
//   // console.log(Object.keys(tree.rootNode.tree));
//   console.log(tree.rootNode.walk().nodeType);
//   // parser.parse(r).textCallback((...z) => console.log(z));
// });
