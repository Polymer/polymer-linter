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
import {Document, Element, ElementMixin, isPositionInsideRange, ParsedDocument, Severity, SourceRange, Warning} from 'polymer-analyzer';

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

    for (const element of document.getByKind('polymer-element')) {
      // TODO(rictic): methods should have astNodes, that would make this
      //     simpler.
      const classBody = getClassBody(element.astNode);
      if (!classBody) {
        continue;
      }

      for (const method of classBody.body) {
        let methodName: undefined|string = undefined;
        if (method.type !== 'MethodDefinition') {
          // Guard against ES2018+ additions to class bodies.
          continue;
        }
        if (method.kind === 'constructor') {
          methodName = 'constructor';
        }
        if (method.kind === 'method' && method.key.type === 'Identifier' &&
            mustCallSuper(element, method.key.name, document)) {
          methodName = method.key.name;
        }
        if (!methodName) {
          continue;
        }

        // Ok, so now just check that the method does call super.methodName()
        if (!doesCallSuper(method, methodName)) {
          // Construct a nice legible warning.
          const parsedDocumentContaining =
              getParsedDocumentContaining(element.sourceRange, document);
          if (parsedDocumentContaining) {
            const correctSyntax = method.kind === 'constructor' ?
                'super()' :
                `super.${methodName}()`;
            const nameOfMethod = method.kind === 'constructor' ?
                'constructor' :
                `${methodName} method override`;
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
    document: Document): ParsedDocument<any, any>|undefined {
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
  return mostSpecificDocument.parsedDocument;
}

function getClassBody(astNode?: estree.Node|null): undefined|estree.ClassBody {
  if (!astNode || !astNode.type) {
    return undefined;
  }
  let classBody: undefined|estree.ClassBody = undefined;
  estraverse.traverse(astNode, {
    enter(node: estree.Node) {
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        classBody = node.body;
        return estraverse.VisitorOption.Break;
      }
    }
  });
  return classBody;
}

function mustCallSuper(
    element: Element, methodName: string, document: Document): boolean {
  // TODO(rictic): look up the inheritance graph for a jsdoc tag that describes
  //     the method as needing to be called?
  if (!methodsThatMustCallSuper.has(methodName)) {
    return false;
  }
  // Did the element's super class define the method?
  if (element.superClass) {
    const superElement =
        onlyOrNone(document.getById('element', element.superClass.identifier));
    if (definesMethod(superElement, methodName)) {
      return true;
    }
  }

  return anyMixinDefinesMethod(element, methodName, document, true);
}

function doesCallSuper(method: estree.MethodDefinition, methodName: string) {
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
  return !!superCallTargets.find((ct) => ct === methodName);
}

function anyMixinDefinesMethod(
    mixinOrElement: ElementMixin|Element,
    methodName: string,
    document: Document,
    skipLocalCheck: boolean) {
  if (!skipLocalCheck && definesMethod(mixinOrElement, methodName)) {
    return true;
  }
  for (const mixinReference of mixinOrElement.mixins) {
    // TODO(rictic): once we have a representation of a Class this should be
    //   something like `document.getById('element')` instead.
    const mixin = onlyOrNone(
        document.getById('element-mixin', mixinReference.identifier));
    // TODO(rictic): if mixins had their own mixins pre-mixed in we wouldn't
    //     need to recurse here.
    if (mixin && anyMixinDefinesMethod(mixin, methodName, document, false)) {
      return true;
    }
  }
  return false;
}

function definesMethod(element: Element|undefined, methodName: string) {
  if (!element) {
    return false;
  }
  return !!element.methods.find((m) => m.name === methodName);
}

function onlyOrNone<V>(iterable: Iterable<V>): V|undefined {
  let first = true;
  let result = undefined;
  for (const val of iterable) {
    if (first) {
      result = val;
      first = false;
    } else {
      return undefined;
    }
  }
  return result;
}

registry.register(new CallSuperInCallbacks());
