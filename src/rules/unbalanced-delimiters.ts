/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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

'use strict';

import {Rule} from '../rule';
import {Document} from 'polymer-analyzer/lib/model/model';
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';
import {PolymerElement} from 'polymer-analyzer/lib/polymer/polymer-element';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import * as matchers from '../matchers';
import * as utils from '../utils';

export class UnbalancedDelimiters implements Rule {
  public async check(document: Document): Promise<Warning[]> {
    let warnings: Warning[] = [];

    const parsedHtml = document.parsedDocument;

    // This linter is only relevant to html documents, so exit out unless the
    // provided document is one.
    if (!(parsedHtml instanceof ParsedHtmlDocument)) {
      return warnings;
    }

    // Address binding expressions only for polymer elements.
    for (const element of document.getByKind('polymer-element')) {
      console.assert(element instanceof PolymerElement);

      for (const warning of this._warningsForPolymerElement(
               parsedHtml, element)) {
        warnings.push(warning);
      }
    }

    return warnings;
  }

  private _warningsForPolymerElement(
      parsedHtml: ParsedHtmlDocument,
      element: PolymerElement): Warning[] {
    let warnings: Warning[] = [];

    if (!element.domModule) {
      return warnings;
    }

    const template = dom5.query(element.domModule, matchers.isTemplate);
    if (!template) {
      return warnings;
    }

    const templateContent =
        parse5.treeAdapters.default.getTemplateContent(template);

    dom5.nodeWalkAll(templateContent, (node: parse5.ASTNode) => {

      if (dom5.isElement(node) && node.attrs.length > 0) {
        for (const warning of this._warningsForElementAttrs(parsedHtml, node)) {
          warnings.push(warning);
        }
      }
      if (dom5.isTextNode(node) && typeof node.value === 'string' &&
          this._isBadBindingExpression(node.value)) {
        warnings.push({
          code: 'unbalanced-delimiters',
          message: `Expression ${node.value} has unbalanced delimiters`,
          severity: Severity.ERROR,
          sourceRange: utils.getSourceRangeForTextNode(parsedHtml.url, node)!
        });
      }

      return false;
    });
    return warnings;
  }

  private _warningsForElementAttrs(
      parsedHtml: ParsedHtmlDocument,
      element: parse5.ASTNode): Warning[] {
    const warnings: Warning[] = [];
    for (const attr of element.attrs) {
      if (this._extractBadBindingExpression(attr.value || '')) {
        warnings.push({
          code: 'unbalanced-delimiters',
          message: `Expression ${attr
                       .value
                   } has unbalanced delimiters in attribute ${attr.name}`,
          severity: Severity.ERROR,
          // TODO(usergenic): Extend polymer-analyzer's ParsedHtmlDocument to
          // provide sourceRangeForAttributeValue specifically.
          sourceRange:
              parsedHtml.sourceRangeForAttribute(element, attr.name)!
        });
      }
    }
    return warnings;
  }

  private _extractBadBindingExpression(text: string): string|undefined {
    // 4 cases, {{}, {}}, [[], []]
    let match = text.match(/\{\{([^\}]*)\}(?!\})/) ||
        text.match(/\[\[([^\]]*)\](?!\])/);
    if (!match) {
      const reversed = text.split('').reverse().join('');
      match = reversed.match(/\}\}([^\{]*)\{(?!\{)/) ||
          reversed.match(/\]\]([^\[]*)\[(?!\[)/);
    }
    if (match) {
      return text;
    }
    return undefined;
  }

  private _isBadBindingExpression(text: string) {
    const bindingMatch = this._extractBadBindingExpression(text);
    return !!bindingMatch || false;
  }
}
