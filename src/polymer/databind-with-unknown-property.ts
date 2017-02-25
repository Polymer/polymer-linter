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

import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document, SourceRange} from 'polymer-analyzer/lib/model/model';
import {DatabindingExpression} from 'polymer-analyzer/lib/polymer/expression-scanner';
import stripIndent = require('strip-indent');
import {Warning, Severity} from 'polymer-analyzer/lib/warning/warning';
import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {closestSpelling} from '../util';
import {sharedProperties} from '../html/util';

export class DatabindWithUnknownProperty extends HtmlRule {
  code = 'databind-with-unknown-property';
  description = stripIndent(`
      Warns when a polymer databinding expression uses an undeclared property.
  `).trim();

  constructor() {
    super();
  }

  async checkDocument(_parsed: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];
    const domModules = document.getByKind('dom-module');
    for (const domModule of domModules) {
      const elements = document.getById(
          'element', domModule.id!, {imported: true, externalPackages: true});
      if (elements.size !== 1) {
        continue;
      }
      const element = elements.values().next().value;

      const explicitlyKnownProperties =
          new Set(element.properties.map((p) => p.name)
                      .concat(Array.from(sharedProperties)));
      type PropertyUse = {
        name: string,
        sourceRange: SourceRange,
        expression: DatabindingExpression
      };
      const suspiciousPropertiesByName = new Map<string, Array<PropertyUse>>();
      for (const expression of domModule.databindings) {
        for (const prop of expression.properties) {
          if (explicitlyKnownProperties.has(prop.name)) {
            continue;
          }
          const props = suspiciousPropertiesByName.get(prop.name) || [];
          props.push(
              {name: prop.name, sourceRange: prop.sourceRange, expression});
          suspiciousPropertiesByName.set(prop.name, props);
        }
      }
      for (const usesOfProperty of suspiciousPropertiesByName.values()) {
        const firstUse = usesOfProperty[0];
        if (!firstUse) {
          throw new Error('This should never happen');
        }
        if (usesOfProperty.length === 1) {
          const bestGuess =
              closestSpelling(firstUse.name, explicitlyKnownProperties)!.min;
          warnings.push({
            code: this.code,
            severity: Severity.WARNING,
            sourceRange: firstUse.sourceRange,
            message:
                `${firstUse.name} is not declared or used more than once. ` +
                `Did you mean: ${bestGuess}`
          });
          continue;
        }
        const hasWrite = !!usesOfProperty.find((use) => {
          // We're writing into a property if it's on an attribute (not e.g. a
          // text node), if it's a bidirectional binding, and it's the only
          // property in the expression. (this isn't perfect, it misses some
          // strange stuff with literals like foo(10, 20) but it's good enough.)
          return use.expression.databindingInto === 'attribute' &&
              use.expression.direction === '{' &&
              use.expression.properties.length === 1;
        });
        // TODO(rictic): when we add the ability to configure a lint pass we
        //     should allow users to force all properties to be declared.
        if (hasWrite) {
          continue;
        }
        warnings.push({
          code: this.code,
          severity: Severity.WARNING,
          sourceRange: firstUse.sourceRange,
          message: `${firstUse.name} is not declared and is only read from, ` +
              `never written to. If it's part of the element's API ` +
              `it should be a declared property.`
        });
      }
    }

    return warnings;
  }
}

registry.register(new DatabindWithUnknownProperty());
