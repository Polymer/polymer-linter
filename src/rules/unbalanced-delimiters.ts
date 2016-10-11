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
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document} from 'polymer-analyzer/lib/model/model';
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';

import * as matchers from '../matchers';
import {Rule} from '../rule';

/**
 * Unbalanced binding expression delimiters occurs when a value such as
 * `[[myValue]]` or `{{myValue}}` have too many or too few brackets on either
 * side.
 */
export class UnbalancedDelimiters implements Rule {
  public async check(document: Document): Promise<Warning[]> {
    let warnings: Warning[] = [];
    const parsedHtml = document.parsedDocument;

    // This linter is only relevant to html documents, so exit out unless the
    // provided document is one.
    if (!(parsedHtml instanceof ParsedHtmlDocument)) {
      return warnings;
    }

    // TODO(usergenic): Extend the Analyzer to identify features which have
    // support for bind expressions and use that instead.
    const templates = dom5.queryAll(
        document.parsedDocument.ast,
        dom5.predicates.OR(
            matchers.isDomBindTemplate, matchers.isDomModuleTemplate));

    for (const template of templates) {
      warnings =
          warnings.concat(this._getWarningsForTemplate(parsedHtml, template));
    }

    return warnings;
  }

  private _getWarningsForElementAttrs(
      parsedHtml: ParsedHtmlDocument,
      element: parse5.ASTNode): Warning[] {
    const warnings: Warning[] = [];
    for (const attr of element.attrs) {
      if (this._extractBadBindingExpression(attr.value || '')) {
        warnings.push({
          code: 'unbalanced-delimiters',
          message: `Expression ${attr.value} has unbalanced delimiters`,
          severity: Severity.ERROR,
          sourceRange:
              parsedHtml.sourceRangeForAttributeValue(element, attr.name)!
        });
      }
    }
    return warnings;
  }

  private _getWarningsForTemplate(
      parsedHtml: ParsedHtmlDocument,
      template: parse5.ASTNode): Warning[] {
    let warnings: Warning[] = [];
    const content = parse5.treeAdapters.default.getTemplateContent(template);

    dom5.nodeWalkAll(content, (node: parse5.ASTNode) => {
      if (dom5.isElement(node) && node.attrs.length > 0) {
        warnings =
            warnings.concat(this._getWarningsForElementAttrs(parsedHtml, node));
        // TODO(usergenic): Decide whether recursing into templates within
        // templates needs any special condition to guard against improperly
        // treating template content as 'bindable'.
        if (matchers.isTemplate(node)) {
          warnings =
              warnings.concat(this._getWarningsForTemplate(parsedHtml, node));
        }
      } else if (
          dom5.isTextNode(node) && typeof node.value === 'string' &&
          this._isBadBindingExpression(node.value)) {
        warnings.push({
          code: 'unbalanced-delimiters',
          message: `Expression ${node.value} has unbalanced delimiters`,
          severity: Severity.ERROR,
          sourceRange: parsedHtml.sourceRangeForNode(node)!
        });
      }
      return false;  // predicates must return boolean & we don't need results.
    });
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
