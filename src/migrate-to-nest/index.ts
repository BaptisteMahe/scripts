import {
  CallExpression,
  Project,
  PropertyAccessExpression,
  SourceFile,
  ts,
  VariableDeclaration,
} from "ts-morph";
import SyntaxKind = ts.SyntaxKind;

// https://ts-ast-viewer.com

const tsConfigFilePath = `/Users/baptistemahe/Documents/repos/unico-workspace/apps/api/tsconfig.app.json`;
const routerPath = `/Users/baptistemahe/Documents/repos/unico-workspace/apps/api/src/app/router.ts`;

const project = new Project({ tsConfigFilePath });

const routerFile = project.getSourceFile(routerPath);
if (!routerFile) throw new Error("Router file not found");

const routerVarDeclaration = getExpressRouterVar(routerFile);
if (!routerVarDeclaration) throw new Error("Router var not found");

const controllers = getControllers(routerVarDeclaration);

for (const { path, identifier } of controllers) {
  const definition = identifier
    .getDefinitions()[0]
    ?.getDeclarationNode()
    ?.asKindOrThrow(SyntaxKind.VariableDeclaration)
    ?.getDescendantsOfKind(SyntaxKind.Identifier)[0];

  if (!definition)
    throw new Error(
      `Controller definition not found ${JSON.stringify({ path, identifier })}`,
    );

  console.log(path);

  const endpoints = definition
    .findReferences()
    .flatMap((it) => it.getReferences())
    .filter((it) => it.getSourceFile().getFilePath() !== routerPath)
    .map((it) => it.getNode().getFirstAncestorByKind(SyntaxKind.CallExpression))
    .filter((it): it is CallExpression => !!it)
    .map(getEndpointOrNull)
    .filter(
      (it): it is ReturnType<typeof getEndpointOrNull> & {} => it !== null,
    );

  for (const endpoint of endpoints) {
    const responseType = endpoint.handler
      .getParameters()[1]!
      .getFirstDescendantByKind(SyntaxKind.TypeReference)
      ?.getDescendants();

    const response =
      responseType?.length === 2 &&
      responseType[0]?.getKind() === SyntaxKind.QualifiedName
        ? responseType[1]
        : null;

    console.log(responseType?.map((it) => it.getText()));
  }
}

function getEndpointOrNull(callExpression: CallExpression) {
  try {
    return {
      callExpression: callExpression,
      method: callExpression
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)[0]!
        .getDescendantsOfKind(SyntaxKind.Identifier)[1]!
        .getText(),
      path: callExpression
        .getArguments()[0]!
        .asKindOrThrow(SyntaxKind.StringLiteral)
        ?.getLiteralValue(),
      handler: callExpression
        .getArguments()
        .at(-1)!
        .asKindOrThrow(SyntaxKind.ArrowFunction),
    };
  } catch (e) {
    return null;
  }
}

function getControllers(routerVarDeclaration: VariableDeclaration) {
  return routerVarDeclaration
    .findReferences()
    .flatMap((reference) => reference.getReferences())
    .map((reference) =>
      reference.getNode().getParentIfKind(SyntaxKind.PropertyAccessExpression),
    )
    .filter(
      (pptAccessExpr): pptAccessExpr is PropertyAccessExpression =>
        !!pptAccessExpr &&
        !!pptAccessExpr
          .getDescendantsOfKind(SyntaxKind.Identifier)
          .find((identifier) => identifier.getText() === "use"),
    )
    .map((ppt) => ppt.getFirstAncestorByKind(SyntaxKind.CallExpression))
    .filter((expression): expression is CallExpression => !!expression)
    .map((expression) => expression.getArguments())
    .map((expressionArguments) => ({
      path: expressionArguments[0]!
        .asKindOrThrow(SyntaxKind.StringLiteral)
        .getLiteralValue(),
      identifier: expressionArguments[1]!.asKindOrThrow(SyntaxKind.Identifier),
    }));
}

function getExpressRouterVar(file: SourceFile) {
  return file.getVariableDeclaration(
    (node) =>
      !!node
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .find((identifier) => identifier.getText() === "express") &&
      !!node
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .find((identifier) => identifier.getText() === "Router"),
  );
}
