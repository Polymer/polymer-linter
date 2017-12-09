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

import {Document, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {stripIndentation} from '../util';

import {HtmlRule} from './rule';
import {removeNode} from './util';


class UndefinedElements extends HtmlRule {
  code = 'unused-imports';
  description = stripIndentation(`
    Warns when an import is not being used.
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document):
      Promise<Warning[]> {
    // Search for element instances.
    const elements = document.getFeatures({ kind: 'element-reference' });
    // We must be in a document dedicated to import all resources...bail out!
    if (elements.size === 0)
      return [];

    // Get all direct imports that define elements.
    let imports = [...document.getFeatures({kind: 'html-import'})].filter(
        (imp) => imp.document.getFeatures({kind: 'element'}).size > 0);
    // search element definitions to get the file where they're defined.
    for (const element of elements) {
      const definitions = document.getFeatures({
        kind: 'element',
        id: element.tagName,
        imported: true,
        externalPackages: true
      });
      // Filter out these elements.
      for (const def of definitions) {
        imports = imports.filter((imp) => imp.url !== def.sourceRange!.file);
      }
    }
    // Remained with the unused imports!
    return imports.map(
        (imp) => new Warning({
          parsedDocument,
          code: 'unused-imports',
          message: `The import ${imp.url} is not used and can be removed.`,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForNode(imp.astNode)!,
          fix: removeNode(parsedDocument, imp.astNode),
        }));
  }
}

registry.register(new UndefinedElements());
