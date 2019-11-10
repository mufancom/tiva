[![NPM Package](https://badge.fury.io/js/tiva.svg)](https://www.npmjs.com/package/tiva)
[![Build Status](https://travis-ci.org/makeflow/tiva.svg?branch=master)](https://travis-ci.org/makeflow/tiva)

# Tiva

⏱️ EXPENSIVE plain object type validator leverages TypeScript language service.

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

Tiva can validate with extended validator functions that matches by `@tag` in JSDoc comments:

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

Custom extensions can be provided by `options.extensions` of `Tiva` constructor.

## License

MIT License.
