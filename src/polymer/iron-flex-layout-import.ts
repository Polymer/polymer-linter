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

import * as dom5 from 'dom5';
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {FixableWarning} from '../warning';

import stripIndent = require('strip-indent');

const deprecatedBase = 'iron-flex-layout/classes';
const replacementImport = 'iron-flex-layout/iron-flex-layout-classes.html';

class IronFlexLayoutImport extends HtmlRule {
  code = 'iron-flex-layout-import';
  description = stripIndent(`
      Warns when the deprecated iron-flex-layout/classes/*.html files are imported.
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, document: Document,
      warnings: FixableWarning[]) {
    const imports = document.getFeatures({ kind: 'import' });
    for (const imp of imports) {
      const href = dom5.getAttribute(imp.astNode, 'href') || '';
      const i = href.indexOf(deprecatedBase);
      if (i === -1) {
        continue;
      }
      const correctImport = href.replace(href.substr(i), replacementImport);
      // Use excludeQuotes = true when Polymer/polymer-analyzer#737 is fixed
      const hrefRange = parsedDocument.sourceRangeForAttributeValue(imp.astNode, 'href')!;
      const warning = new FixableWarning({
        code: 'iron-flex-layout-import',
        message:
            `${href} import is deprecated. ` +
            `Replace with ${correctImport} import.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: hrefRange
      });
      warning.fix = [{
        replacementText: `"${correctImport}"`,
        range: hrefRange
      }];
      warnings.push(warning);
    }
  }
}

registry.register(new IronFlexLayoutImport());
