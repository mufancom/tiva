[![NPM Package](https://badge.fury.io/js/tiva.svg)](https://www.npmjs.com/package/tiva)
[![Build Status](https://travis-ci.org/makeflow/tiva.svg?branch=master)](https://travis-ci.org/makeflow/tiva)
[![Coverage Status](https://coveralls.io/repos/github/makeflow/tiva/badge.svg?branch=master)](https://coveralls.io/github/makeflow/tiva?branch=master)

# Tiva

⏱️ EXPENSIVE plain object type validator leverages TypeScript language service.

## Why

| Category                                        | Complex Type | Extended Validation | Zero Build Setups | Performance                |
| ----------------------------------------------- | ------------ | ------------------- | ----------------- | -------------------------- |
| Tiva                                            | Yes          | Yes                 | Yes               | In many case not tolerable |
| [ajv](https://github.com/epoberezkin/ajv) alike | Yes          | No                  | No                | Much much better than Tiva |
| [io-ts](https://github.com/gcanti/io-ts) alike  | Limited\*    | Yes                 | Yes               | Much much better than Tiva |

\* We have many types that are evaluated from pure type declarations, and those type declarations are used in other part of our project for type checking and intellisense purpose. And aside from that, writing complex type with those tools will not be as pleasant as natural type declarations.

## Usage

```
yarn add tiva
```

```ts
import {Tiva} from 'tiva';

let tiva = new Tiva();

tiva.validate('string[]', ['foo', 'bar']).then(console.info, console.error);

tiva
  .validate(
    {module: 'module-specifier', type: 'AwesomeType'},
    {foo: 'abc', bar: 123},
  )
  .then(console.info, console.error);
```

## Extensions

Tiva can validate with extended validator functions that matches by `@tag` in JSDoc comments (one tag per line):

```ts
interface Foo {
  /** @uuid */
  id: string;
}
```

There are a few built-in extensions:

- `@pattern <pattern>` Validate by regular expression pattern.
- `@uuid [version]` UUID.
- `@unique [group]` Validate that there's no more than one occurrence.

Checkout [@built-in-extensions.ts](src/library/validator/@built-in-extensions.ts) for implementation details.

Writing custom extensions is easy:

```ts
let tiva = new Tiva({
  extensions: {
    custom(value) {
      if (value === 'custom') {
        return undefined;
      }

      return `Value "${value}" must be "custom"`;
    },
  },
});
```

## How it works

Tiva provides a `Validator` class that synchronously manipulates TypeScript language service to do the heavy lifting; and a `Tiva` class that creates a worker to run `Validator` in another thread.

The type check part is simple: it just gets the diagnostic messages from TypeScript by fabricating a variable statement. The tricky part is the extended validation.

Here's how Tiva does it:

1. It recursively visits the types used by the type to be validate against.
2. It find tags like @uuid in those types, and asks TypeScript to find the implementations within the plain object to be validated.
3. It then validates the value against the extension.

Again the heavy lifting is done by the TypeScript language service. And doing this way also makes it possible to have Tiva work with complex types including condition types, mapping types etc.

## License

MIT License.
