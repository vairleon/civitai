import {
  Button,
  Center,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Title,
  TypographyStylesProvider,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { CustomMarkdown } from '~/components/Markdown/CustomMarkdown';
import { OnboardingAbortButton } from '~/components/Onboarding/OnboardingAbortButton';
import { useOnboardingWizardContext } from '~/components/Onboarding/OnboardingWizard';
import { useOnboardingStepCompleteMutation } from '~/components/Onboarding/onboarding.utils';
import { StepperTitle } from '~/components/Stepper/StepperTitle';
import rehypeRaw from 'rehype-raw';

import { OnboardingSteps } from '~/server/common/enums';
import { trpc } from '~/utils/trpc';

export function OnboardingTos() {
  const { next } = useOnboardingWizardContext();
  const { mutate, isLoading } = useOnboardingStepCompleteMutation();

  const handleStepComplete = () => {
    mutate({ step: OnboardingSteps.TOS }, { onSuccess: () => next() });
  };

  const { data: terms, isLoading: termsLoading } = trpc.content.get.useQuery({ slug: 'tos' });

  return (
    <Stack>
      <StepperTitle
        title="Terms of Service"
        description="Please take a moment to review and accept our terms of service."
      />
      <ScrollArea
        style={{ height: 400 }}
        type="auto"
        p="md"
        sx={(theme) => ({
          border: `1px solid ${
            theme.colorScheme === 'light' ? theme.colors.gray[9] : theme.colors.gray[7]
          }`,
        })}
      >
        {termsLoading ? (
          <Center h={366}>
            <Loader size="lg" />
          </Center>
        ) : (
          terms && (
            <>
              <Title order={1}>{terms.title}</Title>
              <TypographyStylesProvider>
                <CustomMarkdown rehypePlugins={[rehypeRaw]}>{terms.content}</CustomMarkdown>
              </TypographyStylesProvider>
            </>
          )
        )}
      </ScrollArea>
      {!termsLoading && (
        <Group position="apart" align="flex-start">
          <OnboardingAbortButton showWarning>Decline</OnboardingAbortButton>
          <Button
            rightIcon={<IconCheck />}
            size="lg"
            onClick={handleStepComplete}
            loading={isLoading}
          >
            Accept
          </Button>
        </Group>
      )}
    </Stack>
  );
}
