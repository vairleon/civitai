import {
  Button,
  Center,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  LoadingOverlay,
  Modal,
  Pagination,
  Progress,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Paper,
  ScrollArea,
  Badge,
  createStyles,
  ActionIcon,
  Anchor,
  Image,
} from '@mantine/core';
import { IconCloudOff, IconDownload, IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useMutateVault, useQueryVault } from '~/components/Vault/vault.util';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { getLoginLink } from '~/utils/login-helpers';
import { formatKBytes } from '~/utils/number-helpers';
import { trpc } from '~/utils/trpc';
import { useQueryVaultItems } from '../../components/Vault/vault.util';
import {
  GetPaginatedVaultItemsSchema,
  vaultItemsAddModelVersionSchema,
} from '~/server/schema/vault.schema';
import { formatDate } from '~/utils/date-helpers';
import { getDisplayName } from '~/utils/string-helpers';
import { isEqual, uniqBy } from 'lodash-es';
import { useDebouncedValue } from '@mantine/hooks';
import { VaultItemsFiltersDropdown } from '~/components/Vault/VaultItemsFiltersDropdown';
import { IconX } from '@tabler/icons-react';
import { VaultItemGetPaged } from '~/types/router';
import { useDialogContext } from '~/components/Dialog/DialogProvider';
import { showSuccessNotification } from '~/utils/notifications';
import { dialogStore } from '~/components/Dialog/dialogStore';
import { NextLink } from '@mantine/next';
import { VaultItemStatus } from '@prisma/client';
import { SortFilter } from '~/components/Filters';
import { VaultSort } from '~/server/common/enums';
import { SelectMenuV2 } from '~/components/SelectMenu/SelectMenu';
import { dbRead } from '~/server/db/client';
import { Tooltip } from 'chart.js';

export const getServerSideProps = createServerSideProps({
  useSession: true,
  resolver: async ({ session, ctx }) => {
    if (!session || !session.user)
      return {
        redirect: {
          destination: getLoginLink({ returnUrl: ctx.resolvedUrl, reason: 'civitai-vault' }),
          permanent: false,
        },
      };

    const hasUsedVault = await dbRead.vault.findFirst({
      where: { userId: session.user.id },
    });

    if (!hasUsedVault)
      return {
        redirect: {
          destination: '/pricing',
          permanent: false,
        },
      };
  },
});

const useStyles = createStyles((theme) => ({
  selected: { background: theme.fn.rgba(theme.colors.blue[8], 0.3), color: theme.colors.gray[0] },
}));

const VaultItemsAddNote = ({ vaultItems }: { vaultItems: VaultItemGetPaged[] }) => {
  const dialog = useDialogContext();
  const handleClose = dialog.onClose;
  const { updateItemsNotes, updatingItemsNotes } = useMutateVault();
  const [notes, setNotes] = useState('');

  const handleConfirm = async () => {
    if (updatingItemsNotes) return;

    await updateItemsNotes({
      modelVersionIds: vaultItems.map((item) => item.modelVersionId as number),
      notes,
    });

    showSuccessNotification({
      title: 'Notes have been updated',
      message: 'Notes for your selected items have been updated successfully',
    });

    handleClose();
  };

  return (
    <Modal {...dialog} size="xs" withCloseButton title="Add notes">
      <Stack>
        <Text size="xs">{vaultItems.length} models selected</Text>
        <Divider mx="-lg" />
        <Textarea
          name="notes"
          placeholder="write your notes here..."
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          withAsterisk
        />
        <Button ml="auto" loading={updatingItemsNotes} onClick={handleConfirm}>
          Done
        </Button>
      </Stack>
    </Modal>
  );
};

const VaultItemsRemove = ({ vaultItems }: { vaultItems: VaultItemGetPaged[] }) => {
  const dialog = useDialogContext();
  const handleClose = dialog.onClose;
  const { removeItems, removingItems } = useMutateVault();
  const { classes, cx } = useStyles();

  const handleConfirm = async () => {
    if (removingItems) return;

    await removeItems({
      modelVersionIds: vaultItems.map((item) => item.modelVersionId as number),
    });

    showSuccessNotification({
      title: 'Items removed',
      message: 'Your selected items have been removed and your storage has been freed.',
    });

    handleClose();
  };

  return (
    <Modal {...dialog} size="md" withCloseButton title={`Deleting ${vaultItems.length} models`}>
      <Stack>
        <Text size="sm">Models deleted from your Civit Vault cannot be retrieved.</Text>

        <ScrollArea.Autosize maxHeight={500}>
          <Stack>
            {vaultItems.map((item) => (
              <Paper withBorder p="sm" radius="lg" key={item.id}>
                <Group>
                  {item.coverImageUrl && (
                    <Image
                      src={item.coverImageUrl}
                      alt="Model Image"
                      radius="sm"
                      width={50}
                      height={50}
                    />
                  )}
                  <Stack spacing={0}>
                    <Text>{item.modelName}</Text>
                    <Text color="dimmed" size="sm">
                      {item.versionName}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        <Divider mx="-lg" />
        <Group grow>
          <Button
            ml="auto"
            loading={removingItems}
            onClick={handleConfirm}
            color="red"
            variant="light"
            fullWidth
            radius="xl"
          >
            Confirm delete
          </Button>
          <Button
            ml="auto"
            disabled={removingItems}
            onClick={handleClose}
            color="gray"
            fullWidth
            radius="xl"
          >
            Don&rsquo;t delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

const VaultItemDownload = ({ vaultItem }: { vaultItem: VaultItemGetPaged }) => {
  const dialog = useDialogContext();
  const handleClose = dialog.onClose;

  return (
    <Modal {...dialog} size="md" withCloseButton title={`Download your model`}>
      <Stack>
        <Text size="sm">Please select what you want to download from your model</Text>

        <Button
          component={NextLink}
          href={`/api/download/vault/${vaultItem.id}?type=model`}
          ml="auto"
          variant="light"
          fullWidth
          radius="xl"
          download
        >
          Model
        </Button>
        <Button
          component={NextLink}
          href={`/api/download/vault/${vaultItem.id}?type=details`}
          ml="auto"
          variant="light"
          fullWidth
          radius="xl"
          download
        >
          Details
        </Button>
        <Button
          component={NextLink}
          href={`/api/download/vault/${vaultItem.id}?type=images`}
          ml="auto"
          variant="light"
          fullWidth
          radius="xl"
          download
        >
          Images
        </Button>
      </Stack>
    </Modal>
  );
};

const VaultItemsStatusDetailsMap = {
  [VaultItemStatus.Stored]: {
    badgeColor: 'green',
    tooltip: (meta: VaultItemMetadataSchema) =>
      'This model is stored in your Civit Vault and is ready for you to download.',
  },
  [VaultItemStatus.Pending]: {
    badgeColor: 'yellow',
    tooltip: (meta: VaultItemMetadataSchema) =>
      'We will be processing this model soon and will be ready to download shortly.',
  },
  [VaultItemStatus.Failed]: {
    badgeColor: 'yellow',
    tooltip: (meta: VaultItemMetadataSchema) =>
      `This model has failed to process ${meta.failuresC} times. After 3 failed attempts, the model will be removed from your Civit Vault.`,
  },
};

export default function CivitaiVault() {
  const currentUser = useCurrentUser();
  const { vault, isLoading: isLoadingVault } = useQueryVault();
  const [filters, setFilters] = useState<Omit<GetPaginatedVaultItemsSchema, 'limit'>>({
    page: 1,
    sort: VaultSort.RecentlyAdded,
  });
  const [debouncedFilters, cancel] = useDebouncedValue(filters, 500);

  const {
    items,
    isLoading: isLoadingVaultItems,
    isRefetching,
    pagination,
  } = useQueryVaultItems(debouncedFilters, { keepPreviousData: true });
  const [selectedItems, setSelectedItems] = useState<VaultItemGetPaged[]>([]);
  const progress = vault
    ? vault.storageKb <= vault.usedStorageKb
      ? 100
      : (vault.usedStorageKb / vault.storageKb) * 100
    : 0;
  const allSelectedInPage = useMemo(() => {
    return items.every((item) => selectedItems.find((i) => i.id === item.id));
  }, [items, selectedItems]);
  const { classes, cx } = useStyles();

  //#region [useEffect] cancel debounced filters
  useEffect(() => {
    if (isEqual(filters, debouncedFilters)) cancel();
  }, [cancel, debouncedFilters, filters]);
  //#endregion

  return (
    <Container size="xl">
      <Group position="apart" align="flex-end" mb="xl">
        <Title order={1}>Civitai Vaut</Title>
        {vault && (
          <Stack spacing={0}>
            <Progress
              style={{ width: '100%' }}
              size="xl"
              value={progress}
              color={progress >= 100 ? 'red' : 'blue'}
              striped
              animate
            />
            <Text>
              {formatKBytes(vault.usedStorageKb)} of {formatKBytes(vault.storageKb)} Used
            </Text>
          </Stack>
        )}
      </Group>

      {isLoadingVault ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : (
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={(isLoadingVaultItems || isRefetching) ?? false} zIndex={9} />

          <Stack>
            <Group position="apart">
              <Group>
                <TextInput
                  radius="xl"
                  variant="filled"
                  icon={<IconSearch size={20} />}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  value={filters.query}
                  placeholder="Models or creators..."
                />
                <VaultItemsFiltersDropdown
                  filters={debouncedFilters}
                  setFilters={(f) => setFilters((c) => ({ ...c, ...f }))}
                />
                <SelectMenuV2
                  label={getDisplayName(filters.sort)}
                  options={Object.values(VaultSort).map((v) => ({ label: v, value: v }))}
                  value={filters.sort}
                  // Resets page:
                  onClick={(x) => setFilters((c) => ({ ...c, sort: x as VaultSort, page: 1 }))}
                  buttonProps={{ size: undefined, compact: false }}
                />
              </Group>

              <Group>
                {selectedItems.length > 0 && (
                  <Button
                    disabled={selectedItems.length === 0}
                    radius="xl"
                    color="blue"
                    variant="light"
                    onClick={() => {
                      setSelectedItems([]);
                    }}
                    rightIcon={<IconX size={14} />}
                  >
                    {selectedItems.length} selected
                  </Button>
                )}
                <Button
                  disabled={selectedItems.length === 0}
                  radius="xl"
                  color="gray"
                  onClick={() => {
                    dialogStore.trigger({
                      component: VaultItemsAddNote,
                      props: {
                        vaultItems: selectedItems,
                      },
                    });
                  }}
                >
                  Add notes
                </Button>
                <Button
                  disabled={selectedItems.length === 0}
                  radius="xl"
                  color="red"
                  onClick={() => {
                    dialogStore.trigger({
                      component: VaultItemsRemove,
                      props: {
                        vaultItems: selectedItems,
                      },
                    });
                  }}
                >
                  Delete
                </Button>
              </Group>
            </Group>

            <Table>
              <thead>
                <tr>
                  <th>
                    <Checkbox
                      checked={allSelectedInPage}
                      onChange={() => {
                        if (allSelectedInPage) {
                          setSelectedItems((c) =>
                            c.filter((i) => !items.find((item) => item.id === i.id))
                          );
                        } else {
                          setSelectedItems((c) => uniqBy([...c, ...items], 'id'));
                        }
                      }}
                      aria-label="Select all items in page"
                      size="sm"
                    />
                  </th>
                  <th>Models</th>
                  <th>Creator</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Date Created</th>
                  <th>Date Added</th>
                  <th>Last Refreshed</th>
                  <th>Notes</th>
                  <th>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <Stack align="center" my="xl">
                        <ThemeIcon size={62} radius={100}>
                          <IconCloudOff />
                        </ThemeIcon>
                        <Text align="center">No items found.</Text>
                      </Stack>
                    </td>
                  </tr>
                )}
                {items.map((item) => {
                  const isSelected = !!selectedItems.find((i) => i.id === item.id);
                  const meta = (item.meta ?? {}) as VaultItemMetadataSchema;

                  return (
                    <tr
                      key={item.id}
                      className={cx({
                        [classes.selected]: isSelected,
                      })}
                    >
                      <td>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedItems((c) => c.filter((i) => i.id !== item.id));
                            } else {
                              setSelectedItems((c) => [...c, item]);
                            }
                          }}
                          aria-label="Select item"
                          size="sm"
                        />
                      </td>
                      <td>
                        <Group>
                          {item.coverImageUrl && (
                            <Image
                              src={item.coverImageUrl}
                              alt="Model Image"
                              radius="sm"
                              width={50}
                              height={50}
                            />
                          )}
                          <Stack spacing={0}>
                            <Anchor
                              href={`/models/${item.modelId}?modelVersionId=${item.modelVersionId}`}
                            >
                              <Text>{item.modelName}</Text>
                            </Anchor>
                            <Text color="dimmed" size="sm">
                              {item.versionName}
                            </Text>
                          </Stack>
                        </Group>
                      </td>
                      <td>{item.creatorName}</td>
                      <td>
                        <Group>
                          <Badge size="sm" color="blue" variant="light">
                            {getDisplayName(item.type)}
                          </Badge>
                          <Badge size="sm" color="gray" variant="outline">
                            {getDisplayName(item.baseModel)}
                          </Badge>
                        </Group>
                      </td>
                      <td>
                        <Text transform="capitalize">{getDisplayName(item.category)}</Text>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{formatDate(item.addedAt)}</td>
                      <td>{item.refreshedAt ? formatDate(item.refreshedAt) : '-'}</td>
                      <td>
                        <Stack>
                          <Tooltip
                            label={VaultItemsStatusDetailsMap[item.status].tooltip(meta.failures)}
                          >
                            <Badge
                              size="xs"
                              color={VaultItemsStatusDetailsMap[item.status].badgeColor}
                            >
                              {getDisplayName(item.status as VaultItemStatus)}
                            </Badge>
                          </Tooltip>
                          <Text>{item.notes ?? '-'}</Text>
                        </Stack>
                      </td>
                      <td>
                        {/* {item.status === VaultItemStatus.Stored && ( */}
                        <ActionIcon
                          onClick={() => {
                            dialogStore.trigger({
                              component: VaultItemDownload,
                              props: {
                                vaultItem: item,
                              },
                            });
                          }}
                        >
                          <IconDownload />
                        </ActionIcon>
                        {/* )} */}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {pagination && pagination.totalPages > 1 && (
                <Group position="apart">
                  <Text>Total {pagination.totalItems.toLocaleString()} items</Text>
                  <Pagination
                    page={filters.page}
                    onChange={(page) => setFilters((curr) => ({ ...curr, page }))}
                    total={pagination.totalPages}
                  />
                </Group>
              )}
            </Table>
          </Stack>
        </div>
      )}
    </Container>
  );
}
