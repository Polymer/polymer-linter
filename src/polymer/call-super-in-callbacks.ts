/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as estraverse from 'estraverse';
import * as estree from 'estree';
import {Document, isPositionInsideRange, ParsedJavaScriptDocument, Severity, SourceRange, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {Rule} from '../rule';
import {stripWhitespace} from '../util';

import stripIndent = require('strip-indent');

const methodsThatMustCallSuper = new Set([
  'ready',
  'connectedCallback',
  'disconnectedCallback',
  'attributeChangedCallback',
]);

export class CallSuperInCallbacks extends Rule {
  code = 'call-super-in-callbacks';
  description = stripIndent(`
      Warns when a Polymer element overrides one of the custom element callbacks
      but does not call super.callbackName().
  `).trim();

  constructor() {
    super();
  }

  async check(document: Document) {
    const warnings: Warning[] = [];
    const elements = document.getByKind('polymer-element');

    for (const element of elements) {
      const classBody = getClassBody(element.astNode);
      if (!classBody) {
        continue;
      }

      for (const method of classBody.body) {
        let methodName: undefined|string = undefined;
        if (method.kind === 'constructor') {
          methodName = 'constructor';
        }
        if (method.kind === 'method' && method.key.type === 'Identifier' &&
            methodsThatMustCallSuper.has(method.key.name)) {
          methodName = method.key.name;
        }
        if (!methodName) {
          continue;
        }
        // Ok, we want to ensure that we call super in this method's body
        const statements = method.value.body.body;
        const superCallTargets = statements.map((s) => {
          if (s.type === 'ExpressionStatement' &&
              s.expression.type === 'CallExpression') {
            const callee = s.expression.callee;
            // Just super()
            if (callee.type === 'Super') {
              return 'constructor';
            }
            // super.foo()
            if (callee.type === 'MemberExpression' &&
                callee.object.type === 'Super' &&
                callee.property.type === 'Identifier') {
              return callee.property.name;
            }
          }
        });
        const doesCallSuper =
            !!superCallTargets.find((ct) => ct === methodName);
        if (!doesCallSuper) {
          const correctSyntax = method.kind === 'constructor' ?
              'super()' :
              `super.${methodName}()`;
          const nameOfMethod = method.kind === 'constructor' ?
              'constructor' :
              `${methodName} method override`;
          const parsedDocumentContaining =
              getParsedDocumentContaining(element.sourceRange, document);
          if (parsedDocumentContaining) {
            warnings.push({
              code: this.code,
              severity: Severity.ERROR,
              sourceRange:
                  parsedDocumentContaining.sourceRangeForNode(method.key)!,
              message: stripWhitespace(`
                Elements that extend Polymer.Element must call
                ${correctSyntax}
                in their ${nameOfMethod}.
            `)
            });
          }
        }
      }
    }
    return warnings;
  }
}

function getParsedDocumentContaining(
    sourceRange: SourceRange|undefined,
    document: Document): ParsedJavaScriptDocument|undefined {
  if (!sourceRange) {
    return undefined;
  }
  let mostSpecificDocument: undefined|Document = undefined;
  for (const doc of document.getByKind('document')) {
    if (isPositionInsideRange(sourceRange.start, doc.sourceRange)) {
      if (!mostSpecificDocument ||
          isPositionInsideRange(
              doc.sourceRange!.start, mostSpecificDocument.sourceRange)) {
        mostSpecificDocument = doc;
      }
    }
  }
  mostSpecificDocument = mostSpecificDocument || document;
  // TODO(rictic): export ParsedDocument from analyzer.
  return mostSpecificDocument.parsedDocument as any;
}

function getClassBody(astNode?: estree.Node|null): undefined|estree.ClassBody {
  if (!astNode || !astNode.type) {
    return undefined;
  }
  let classBody: undefined|estree.ClassBody = undefined;
  estraverse.traverse(astNode, {
    enter(node: estree.Node) {
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        /**
         * Analyzer conflates vanilla custom elements and Polymer 2.0 elements.
         * Yes this is bad. Work around it for now by not running this lint pass
         * over classes that extend HTMLElement.
         *
         * Delete this conditional later, as we shouldn't be getting vanilla
         * custom element definitions in our polymer-element kind results
         * anyways.
         */
        if (!node.superClass || (node.superClass.type === 'Identifier' &&
                                 node.superClass.name === 'HTMLElement')) {
          return estraverse.VisitorOption.Break;
        }

        classBody = node.body;
        return estraverse.VisitorOption.Break;
      }
    }
  });
  return classBody;
}

registry.register(new CallSuperInCallbacks());
