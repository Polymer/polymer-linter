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
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document} from 'polymer-analyzer/lib/model/model';

import stripIndent = require('strip-indent');
import {Warning, Severity} from 'polymer-analyzer/lib/warning/warning';
import {stripWhitespace} from '../util';
import {HtmlRule} from './rule';
import {registry} from '../registry';

const p = dom5.predicates;

export class DomModuleAfterPolymer extends HtmlRule {
  code = 'dom-module-after-polymer';
  description = stripIndent(`
      Warns for incorrectly ordered dom-modules:

          <script>Polymer({ is: 'foo-bar' })</script>
          <dom-module id="foo-bar">
          </dom-module>

      Correct syntax:

          <dom-module id="foo-bar">
          </dom-module>
          <script>Polymer({ is: 'foo-bar' })</script>
  `).trim();

  constructor() {
    super();
  }

  async checkDocument(_parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];
    const elements = document.getByKind('polymer-element');
    const moduleForId = (id: string) =>
        p.AND(p.hasTagName('dom-module'), p.hasAttrValue('id', id));

    for (const element of elements) {
      const domModule = document.getOnlyAtId(
          'dom-module',
          element.tagName!,
          {imported: true, externalPackages: true});

      if (domModule && element.scriptElement) {
        const otherDomModule = dom5.nodeWalkPrior(
            element.scriptElement, moduleForId(element.tagName!));

        if (!otherDomModule) {
          warnings.push({
            code: this.code,
            message: stripWhitespace(`
                dom-module for ${element.tagName} should be a parent
                of it or earlier in the document`),
            severity: Severity.WARNING,
            sourceRange: domModule.sourceRange
          });
        }
      }
    }
    return warnings;
  }
}

registry.register(new DomModuleAfterPolymer());
