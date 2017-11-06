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
import {removeTrailingWhitespace} from '../html/util';
import {registry} from '../registry';
import {FixableWarning, Replacement} from '../warning';

import stripIndent = require('strip-indent');

const deprecatedImports =
    /iron-flex-layout\/classes\/iron-(shadow-)?flex-layout.html/;
const replacementImport = 'iron-flex-layout/iron-flex-layout-classes.html';

const p = dom5.predicates;

const isImport = p.AND(
    p.hasTagName('link'), p.hasAttrValue('rel', 'import'), p.hasAttr('href'));

class IronFlexLayoutImport extends HtmlRule {
  code = 'iron-flex-layout-import';
  description = stripIndent(`
      Warns when the deprecated iron-flex-layout/classes/*.html files are imported.

      This:

          <link rel="import" href="../iron-flex-layout/classes/iron-flex-layout.html">
          <link rel="import" href="../iron-flex-layout/classes/iron-shadow-flex-layout.html">

      Should instead be written as:

          <link rel="import" href="../iron-flex-layout/iron-flex-layout-classes.html">
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, _: Document,
      warnings: FixableWarning[]) {
    const imports = dom5.queryAll(parsedDocument.ast, isImport);
    let goodImport: dom5.Node|null = null;
    const badImports: dom5.Node[] = [];
    for (const imp of imports) {
      const href = dom5.getAttribute(imp, 'href')!;
      if (href.endsWith(replacementImport)) {
        goodImport = imp;
      } else if (deprecatedImports.test(href)) {
        badImports.push(imp);
      }
    }
    badImports.forEach((imp, i) => {
      const href = dom5.getAttribute(imp, 'href')!;
      const correctImport = href.replace(deprecatedImports, replacementImport);
      const warning = new FixableWarning({
        code: 'iron-flex-layout-import',
        message: `${href} import is deprecated in iron-flex-layout v1, ` +
            `and not shipped in iron-flex-layout v2.
Replace it with ${correctImport} import.
Run the lint rule \`iron-flex-layout-classes\` with \`--fix\` to include the required style modules.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForAttributeValue(imp, 'href')!
      });
      const fix: Replacement[] = [];
      if (goodImport || i > 0) {
        const parentChildren = imp.parentNode!.childNodes!;
        const prevNode = parentChildren[parentChildren.indexOf(imp)! - 1];
        if (prevNode && dom5.isTextNode(prevNode)) {
          const trailingWhiteSpace =
              removeTrailingWhitespace(prevNode, parsedDocument);
          if (trailingWhiteSpace) {
            fix.push(trailingWhiteSpace);
          }
        }
        fix.push({
          replacementText: '',
          range: parsedDocument.sourceRangeForNode(imp)!
        });
      } else {
        fix.push({
          replacementText: `"${correctImport}"`,
          range: parsedDocument.sourceRangeForAttributeValue(imp, 'href')!
        });
      }
      warning.fix = fix;
      warnings.push(warning);
    });
  }
}

registry.register(new IronFlexLayoutImport());
