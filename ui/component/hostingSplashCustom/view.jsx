// @flow
import React from 'react';
import Button from 'component/button';
import { Form } from 'component/common/form-components/form';
import SettingStorage from 'component/settingStorage';
import { withDesktopRouter } from 'component/common/desktop-router';

type Props = {
  handleNextPage: () => void,
  handleGoBack: () => void,
};

function HostingSplashCustom(props: Props) {
  const { handleNextPage, handleGoBack } = props;

  return (
    <section className="main--contained">
      <div className={'first-run__wrapper'}>
        <SettingStorage isWelcome />
        <Form onSubmit={handleNextPage} className="section__body">
          <div className={'card__actions'}>
            <Button button="primary" label={__(`Let's go`)} type="submit" />
            <Button button="link" label={__(`Go back`)} onClick={handleGoBack} />
          </div>
        </Form>
      </div>
    </section>
  );
}

const RoutedHostingSplashCustom: React.ComponentType<Omit<Props, 'history' | 'location'>> =
  withDesktopRouter<Props>(HostingSplashCustom);
export default RoutedHostingSplashCustom;
