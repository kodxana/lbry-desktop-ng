// @flow
/* eslint-disable no-use-before-define */
declare type GetState = () => any;
declare type ThunkAction<Result = any> = (dispatch: Dispatch, getState: GetState) => Result;
declare type Dispatch = (action: { ... } | Promise<unknown> | Array<{ ... }> | ThunkAction) => any; // Need to refer to ThunkAction
/* eslint-enable */
