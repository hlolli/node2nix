import slasp from "slasp";
import nijs from "nijs";

export class Sources extends nijs.NixASTNode {
  constructor() {
    super();
    this.sources = {};
  }
  addSource(source) {
    if (!this.sources[source.identifier]) {
      this.sources[source.identifier] = source;
    }
  }

  toNixAST() {
    const ast = new nijs.NixRecursiveAttrSet({});

    Object.keys(this.sources)
      .sort()
      .forEach((identifier) => {
        var source = this.sources[identifier];
        ast.value[identifier] = source.toNixAST();
      });

    return ast;
  }
}
