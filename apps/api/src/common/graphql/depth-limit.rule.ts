import { GraphQLError, Kind } from 'graphql';

import type {
  FragmentDefinitionNode,
  SelectionSetNode,
  ValidationContext,
  ValidationRule,
} from 'graphql';

type Fragments = ReadonlyMap<string, FragmentDefinitionNode>;

function depthOf(set: SelectionSetNode, fragments: Fragments, visited: Set<string>): number {
  let deepest = 0;
  for (const selection of set.selections) {
    if (selection.kind === Kind.FIELD) {
      const child = selection.selectionSet;
      const inner = child === undefined ? 0 : depthOf(child, fragments, visited);
      deepest = Math.max(deepest, 1 + inner);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(deepest, depthOf(selection.selectionSet, fragments, visited));
    } else {
      const name = selection.name.value;
      const fragment = fragments.get(name);
      if (fragment !== undefined && !visited.has(name)) {
        const next = new Set(visited).add(name);
        deepest = Math.max(deepest, depthOf(fragment.selectionSet, fragments, next));
      }
    }
  }
  return deepest;
}

/** Rejects operations nested deeper than `maxDepth` field levels (DECISIONS.md ADR-031). */
export function depthLimitRule(maxDepth: number): ValidationRule {
  return (context: ValidationContext) => {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const definition of context.getDocument().definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition);
      }
    }
    return {
      OperationDefinition(node) {
        const depth = depthOf(node.selectionSet, fragments, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Query depth ${String(depth)} exceeds the limit of ${String(maxDepth)}.`,
              {
                nodes: [node],
              },
            ),
          );
        }
      },
    };
  };
}
