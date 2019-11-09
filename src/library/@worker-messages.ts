import {ValidatorOptions, GeneralValidatorTypeOptions} from './validator';

export type Request = InitializeRequest | DiagnoseRequest;

export interface InitializeRequest {
  type: 'initialize';
  options: ValidatorOptions;
}

export interface DiagnoseRequest {
  type: 'diagnose';
  typeOptions: GeneralValidatorTypeOptions;
  value: unknown;
}

export type Response = InitializeResponse | DiagnoseResponse | ErrorResponse;

export interface InitializeResponse {
  type: 'initialize';
}

export interface DiagnoseResponse {
  type: 'diagnose';
  reasons: string[] | undefined;
}

export interface ErrorResponse {
  type: 'error';
  message: string;
}
