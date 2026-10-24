// @flow
import React from 'react';
import UserSignUp from 'component/userSignUp';
import Page from 'component/page';

export default function SignUpPage(): React.Node {
  return (
    <Page authPage noFooter>
      <UserSignUp />
    </Page>
  );
}
