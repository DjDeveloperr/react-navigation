import * as NativeScriptRuntime from '@nativescript/react-native';
import * as React from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import type {
  ScreenProps,
  ScreenStackHeaderConfigProps,
} from 'react-native-screens';

const REGISTRY_KEY = '__reactNavigationNativeScriptStackRegistry';
const MOUNT_VIEW_TAG = 82734091;
const BACK_BUTTON_TAG = 82734092;
const MODAL_VIEW_TAG = 82734093;
const SCREEN_ID_SEPARATOR = '\u001f';

let nextStackId = 0;

type NativeScriptStackRegistry = {
  stacks: Record<string, any>;
  screens: Record<string, any>;
  stackActiveScreenIds: Record<string, string[]>;
  stackContexts: Record<string, any>;
  stackNativeKeys: Record<string, string | undefined>;
  stackNativeCounts: Record<string, number | undefined>;
  stackTransitioning: Record<string, boolean | undefined>;
  stackTransitionClosing: Record<string, boolean | undefined>;
  stackTransitionNativeDriven: Record<string, boolean | undefined>;
  stackTransitionScreenIds: Record<string, string | undefined>;
  stackTransitionTokens: Record<string, number | undefined>;
  stackPendingContentRetries: Record<string, number | undefined>;
  stackModalNavigationControllers: Record<string, any>;
  stackModalKeys: Record<string, string | undefined>;
  stackModalPresentedModally: Record<string, boolean | undefined>;
  stackModalDismissRequestedFromJS: Record<string, boolean | undefined>;
  screenHeaderConfigs: Record<string, ScreenStackHeaderConfigProps | undefined>;
  screenContexts: Record<string, any>;
  screenControllerHashes: Record<string, number | string | undefined>;
  screenParents: Record<string, string | undefined>;
  screenProps: Record<string, NativeScriptScreenStackItemProps | undefined>;
};

type NativeStackChangeEvent = {
  nativeEvent: {
    screenIds: string[];
  };
};

type NativeStackTransitionEvent = {
  nativeEvent: {
    phase: 'start' | 'end';
    closing: boolean;
    screenId: string;
  };
};

type NativeScriptScreenStackProps = {
  children?: React.ReactNode;
  onNativeStackChange?: (event: NativeStackChangeEvent) => void;
  onNativeStackTransition?: (event: NativeStackTransitionEvent) => void;
  style?: StyleProp<ViewStyle>;
};

type NativeScriptScreenStackItemProps = Omit<
  ScreenProps,
  'enabled' | 'isNativeStack' | 'hasLargeHeader'
> &
  ViewProps & {
    contentStyle?: StyleProp<ViewStyle>;
    headerConfig?: ScreenStackHeaderConfigProps | undefined;
    nativeScriptContentRevision?: number;
    parentId?: string;
    screenId: string;
  };

type RegisteredStackItem = {
  active: boolean;
  order: number;
  props: NativeScriptScreenStackItemProps;
};

type NativeScriptScreenStackContextValue = {
  stackId: string;
  registerScreen: (
    screenId: string,
    props: NativeScriptScreenStackItemProps,
    active: boolean
  ) => void;
  unregisterScreen: (screenId: string) => void;
};

const NativeScriptScreenStackContext =
  React.createContext<NativeScriptScreenStackContextValue | null>(null);

function getRegistry(
  globalObject: Record<string, any>
): NativeScriptStackRegistry {
  'worklet';
  const existing = globalObject[REGISTRY_KEY];

  if (existing) {
    return existing;
  }

  const registry = {
    stacks: {},
    screens: {},
    stackActiveScreenIds: {},
    stackContexts: {},
    stackNativeKeys: {},
    stackNativeCounts: {},
    stackTransitioning: {},
    stackTransitionClosing: {},
    stackTransitionNativeDriven: {},
    stackTransitionScreenIds: {},
    stackTransitionTokens: {},
    stackPendingContentRetries: {},
    stackModalNavigationControllers: {},
    stackModalKeys: {},
    stackModalPresentedModally: {},
    stackModalDismissRequestedFromJS: {},
    screenHeaderConfigs: {},
    screenContexts: {},
    screenControllerHashes: {},
    screenParents: {},
    screenProps: {},
  };

  globalObject[REGISTRY_KEY] = registry;

  return registry;
}

function nativeValue(name: string) {
  'worklet';
  const globalObject = globalThis as Record<string, any>;
  const api = globalObject.__nativeScriptNativeApi;

  return api?.[name] ?? globalObject[name];
}

function nativeColor(value: unknown, fallbackName: string) {
  'worklet';
  const UIColor = nativeValue('UIColor');

  if (!UIColor) {
    return null;
  }

  if (typeof value === 'string') {
    if (value === 'transparent') {
      return UIColor.clearColor;
    }

    if (value[0] === '#') {
      const hex = value.slice(1);
      const normalized =
        hex.length === 3
          ? hex
              .split('')
              .map((part) => part + part)
              .join('')
          : hex.length === 4
            ? hex
                .slice(0, 3)
                .split('')
                .map((part) => part + part)
                .join('') +
              hex[3] +
              hex[3]
            : hex;
      const hasAlpha = normalized.length === 8;
      const integer = Number.parseInt(normalized, 16);

      if (!Number.isNaN(integer)) {
        const red = ((integer >> (hasAlpha ? 24 : 16)) & 255) / 255;
        const green = ((integer >> (hasAlpha ? 16 : 8)) & 255) / 255;
        const blue = ((integer >> (hasAlpha ? 8 : 0)) & 255) / 255;
        const alpha = hasAlpha ? (integer & 255) / 255 : 1;

        if (typeof UIColor.colorWithRedGreenBlueAlpha === 'function') {
          return UIColor.colorWithRedGreenBlueAlpha(red, green, blue, alpha);
        }
      }
    }
  }

  return UIColor[fallbackName] ?? null;
}

function rectEdgeAll() {
  'worklet';
  const edge = nativeValue('UIRectEdge');

  return edge?.All ?? edge?.all ?? 15;
}

function backButtonDisplayMode(mode: unknown) {
  'worklet';
  const enumValue = nativeValue('UINavigationItemBackButtonDisplayMode');

  if (mode === 'generic') {
    return enumValue?.Generic ?? enumValue?.generic ?? 1;
  }

  if (mode === 'minimal') {
    return enumValue?.Minimal ?? enumValue?.minimal ?? 2;
  }

  return enumValue?.Default ?? enumValue?.default ?? 0;
}

function largeTitleDisplayMode(enabled: boolean) {
  'worklet';
  const enumValue = nativeValue('UINavigationItemLargeTitleDisplayMode');

  return enabled
    ? (enumValue?.Always ?? enumValue?.always ?? 1)
    : (enumValue?.Never ?? enumValue?.never ?? 2);
}

function plainBarButtonStyle() {
  'worklet';
  const style = nativeValue('UIBarButtonItemStyle');

  return style?.Plain ?? style?.plain ?? 0;
}

function modalPresentationStyle(presentation: unknown) {
  'worklet';
  const style = nativeValue('UIModalPresentationStyle');

  if (presentation === 'transparentModal') {
    return style?.OverFullScreen ?? style?.overFullScreen ?? 5;
  }

  if (presentation === 'containedTransparentModal') {
    return style?.OverCurrentContext ?? style?.overCurrentContext ?? 6;
  }

  if (presentation === 'containedModal') {
    return style?.CurrentContext ?? style?.currentContext ?? 3;
  }

  if (presentation === 'formSheet') {
    return style?.FormSheet ?? style?.formSheet ?? 2;
  }

  return style?.OverFullScreen ?? style?.overFullScreen ?? 5;
}

function modalTransitionStyle() {
  'worklet';
  const style = nativeValue('UIModalTransitionStyle');

  return style?.CoverVertical ?? style?.coverVertical ?? 0;
}

function isModalPresentation(presentation: unknown) {
  'worklet';

  return Boolean(
    presentation && presentation !== 'push' && presentation !== 'card'
  );
}

function configureExtendedLayout(controller: any) {
  'worklet';

  if (!controller) {
    return;
  }

  controller.edgesForExtendedLayout = rectEdgeAll();
  controller.extendedLayoutIncludesOpaqueBars = true;
}

function createArray(values: any[]) {
  'worklet';
  const NSArray = nativeValue('NSArray');

  if (NSArray && typeof NSArray.arrayWithArray === 'function') {
    return NSArray.arrayWithArray(values);
  }

  return values;
}

function arrayCount(value: any) {
  'worklet';

  if (!value) {
    return 0;
  }

  if (typeof value.count === 'number') {
    return value.count;
  }

  if (typeof value.length === 'number') {
    return value.length;
  }

  return 0;
}

function arrayItem(value: any, index: number) {
  'worklet';

  if (!value) {
    return null;
  }

  const count = arrayCount(value);

  if (index < 0 || index >= count) {
    return null;
  }

  if (typeof value.objectAtIndex === 'function') {
    return value.objectAtIndex(index);
  }

  return value[index] ?? null;
}

function removeTaggedSubviews(rootView: any, tag: number) {
  'worklet';

  if (!rootView) {
    return;
  }

  const subviews = rootView.subviews;
  const count = arrayCount(subviews);

  for (let index = count - 1; index >= 0; index -= 1) {
    const subview = arrayItem(subviews, index);

    if (!subview) {
      continue;
    }

    removeTaggedSubviews(subview, tag);

    if (
      subview.tag === tag &&
      typeof subview.removeFromSuperview === 'function'
    ) {
      subview.userInteractionEnabled = false;
      subview.hidden = true;
      subview.removeFromSuperview();
    }
  }
}

function flexibleSizeMask() {
  'worklet';

  return 18;
}

function isNativeScrollView(view: any) {
  'worklet';
  const UIScrollView = nativeValue('UIScrollView');

  return Boolean(
    UIScrollView &&
    view &&
    typeof view.isKindOfClass === 'function' &&
    view.isKindOfClass(UIScrollView)
  );
}

function shouldFillHostedSubview(rootView: any, subview: any) {
  'worklet';
  const parentBounds = rootView?.bounds ?? rootView?.frame;
  const frame = subview?.frame;
  const parentWidth = parentBounds?.size?.width ?? 0;
  const childWidth = frame?.size?.width ?? 0;
  const originX = frame?.origin?.x ?? 0;
  const originY = frame?.origin?.y ?? 0;

  if (parentWidth <= 0) {
    return false;
  }

  return (
    Math.abs(originX) < 1 &&
    Math.abs(originY) < 1 &&
    (childWidth <= 0 || Math.abs(childWidth - parentWidth) < 2)
  );
}

function layoutHostedSubviewChain(rootView: any, depth: number) {
  'worklet';

  if (!rootView || depth > 8 || isNativeScrollView(rootView)) {
    return;
  }

  const subviews = rootView.subviews;
  const count = arrayCount(subviews);

  for (let index = 0; index < count; index += 1) {
    const subview = arrayItem(subviews, index);

    if (!subview || !shouldFillHostedSubview(rootView, subview)) {
      continue;
    }

    subview.frame = rootView.bounds;
    subview.autoresizingMask = flexibleSizeMask();

    layoutHostedSubviewChain(subview, depth + 1);
  }
}

function enableHostedInteraction(rootView: any, depth: number) {
  'worklet';

  if (!rootView || depth > 12) {
    return;
  }

  rootView.userInteractionEnabled = true;

  const subviews = rootView.subviews;
  const count = arrayCount(subviews);

  for (let index = 0; index < count; index += 1) {
    enableHostedInteraction(arrayItem(subviews, index), depth + 1);
  }
}

function layoutHostedReactSubviews(controller: any) {
  'worklet';
  const rootView = controller?.view;

  if (!rootView) {
    return;
  }

  enableHostedInteraction(rootView, 0);

  const subviews = rootView.subviews;
  const count = arrayCount(subviews);

  for (let index = 0; index < count; index += 1) {
    const subview = arrayItem(subviews, index);

    if (!subview) {
      continue;
    }

    subview.frame = rootView.bounds;
    subview.autoresizingMask = flexibleSizeMask();
    layoutHostedSubviewChain(subview, 0);
  }
}

function layoutNavigationStackViews(navigationController: any) {
  'worklet';

  if (!navigationController?.view) {
    return;
  }

  const parentBounds =
    navigationController.tabBarController?.view?.bounds ??
    navigationController.view.superview?.bounds;

  if (parentBounds) {
    navigationController.view.frame = parentBounds;
  }

  navigationController.view.autoresizingMask = flexibleSizeMask();

  const viewControllers = navigationController.viewControllers;
  const count = arrayCount(viewControllers);

  for (let index = 0; index < count; index += 1) {
    const controller = arrayItem(viewControllers, index);

    if (!controller?.view) {
      continue;
    }

    controller.view.frame = navigationController.view.bounds;
    controller.view.autoresizingMask = flexibleSizeMask();
    layoutHostedReactSubviews(controller);
  }
}

function configureHeaderBackButton(
  controller: any,
  props: Readonly<NativeScriptScreenStackItemProps>,
  isTopScreen: boolean,
  canGoBack: boolean
) {
  'worklet';
  const navigationItem = controller?.navigationItem;

  if (!navigationItem) {
    return;
  }

  const existingItem = navigationItem.leftBarButtonItem;
  const existingButton = existingItem?.customView;
  const hasNativeScriptBackButton = existingButton?.tag === BACK_BUTTON_TAG;
  const shouldShowBackButton =
    canGoBack && isTopScreen && props.headerConfig?.hideBackButton !== true;

  if (hasNativeScriptBackButton) {
    navigationItem.leftBarButtonItem = null;
  }

  navigationItem.hidesBackButton = !shouldShowBackButton;
}

function configureSourceBackButton(
  navigationItem: any,
  headerConfig?: ScreenStackHeaderConfigProps
) {
  'worklet';

  if (!navigationItem) {
    return;
  }

  const displayMode =
    headerConfig?.backTitleVisible === false
      ? 'minimal'
      : headerConfig?.backButtonDisplayMode;
  const title =
    headerConfig?.backTitleVisible === false || displayMode === 'minimal'
      ? ''
      : headerConfig?.backTitle;

  navigationItem.backButtonDisplayMode = backButtonDisplayMode(displayMode);
  navigationItem.backButtonTitle = title ?? '';

  const existingItem = navigationItem.backBarButtonItem;

  if (existingItem?.accessibilityLabel === 'Back') {
    existingItem.title = title ?? '';
    existingItem.style = plainBarButtonStyle();
    return;
  }

  const UIBarButtonItem = nativeValue('UIBarButtonItem');

  if (!UIBarButtonItem || typeof UIBarButtonItem.alloc !== 'function') {
    return;
  }

  const allocatedItem = UIBarButtonItem.alloc();
  const item =
    allocatedItem &&
    typeof allocatedItem.initWithTitleStyleTargetAction === 'function'
      ? allocatedItem.initWithTitleStyleTargetAction(
          '',
          plainBarButtonStyle(),
          null,
          null
        )
      : allocatedItem;

  if (item) {
    item.title = title ?? '';
    item.style = plainBarButtonStyle();
    item.accessibilityLabel = 'Back';
    navigationItem.backBarButtonItem = item;
  }
}

function measuredHeaderHeight(navigationController: any, fallback: number) {
  'worklet';
  const navigationBar = navigationController?.navigationBar;
  const frame = navigationBar?.frame;
  const originY = frame?.origin?.y ?? 0;
  const height = frame?.size?.height ?? 0;

  if (height > 0) {
    return originY + height;
  }

  const insets =
    navigationController?.view?.safeAreaInsets ??
    navigationController?.topViewController?.view?.safeAreaInsets;
  const topInset = insets?.top ?? 0;

  return topInset + fallback;
}

function emitHeaderHeightChange(
  controller: any,
  props: Readonly<NativeScriptScreenStackItemProps>,
  ctx?: any
) {
  'worklet';

  if (
    !ctx ||
    props.headerConfig?.hidden === true ||
    typeof props.onHeaderHeightChange !== 'function'
  ) {
    return;
  }

  ctx.emit('onHeaderHeightChange', {
    nativeEvent: {
      headerHeight: measuredHeaderHeight(
        controller?.navigationController,
        isModalPresentation(props.stackPresentation) ? 56 : 44
      ),
    },
  });
}

function clearScreenRecord(
  registry: NativeScriptStackRegistry,
  screenId: string
) {
  'worklet';

  registry.screens[screenId] = undefined;
  registry.screenHeaderConfigs[screenId] = undefined;
  registry.screenContexts[screenId] = undefined;
  registry.screenControllerHashes[screenId] = undefined;
  registry.screenParents[screenId] = undefined;
  registry.screenProps[screenId] = undefined;
}

function controllerHash(controller: any) {
  'worklet';

  const hash = controller?.hash;

  return typeof hash === 'number' || typeof hash === 'string'
    ? hash
    : undefined;
}

function setScreenControllerIdentity(controller: any, screenId: string) {
  'worklet';

  if (!controller) {
    return;
  }

  controller.__nativeScriptScreenId = screenId;
  controller.restorationIdentifier = screenId;

  if (controller.view) {
    controller.view.accessibilityIdentifier = screenId;
  }
}

function screenIdForController(
  controller: any,
  registry: NativeScriptStackRegistry
) {
  'worklet';

  const taggedScreenId =
    controller?.__nativeScriptScreenId ??
    controller?.restorationIdentifier ??
    controller?.view?.accessibilityIdentifier;

  if (typeof taggedScreenId === 'string' && registry.screens[taggedScreenId]) {
    return taggedScreenId;
  }

  const hash = controllerHash(controller);

  if (hash != null) {
    for (const screenId in registry.screenControllerHashes) {
      if (registry.screenControllerHashes[screenId] === hash) {
        return screenId;
      }
    }
  }

  for (const screenId in registry.screens) {
    if (registry.screens[screenId] === controller) {
      return screenId;
    }
  }

  return undefined;
}

function navigationControllerContainsController(
  navigationController: any,
  controller: any
) {
  'worklet';

  if (!navigationController || !controller) {
    return false;
  }

  const viewControllers = navigationController.viewControllers;
  const count = arrayCount(viewControllers);

  for (let index = 0; index < count; index += 1) {
    if (arrayItem(viewControllers, index) === controller) {
      return true;
    }
  }

  return false;
}

function screenIdInList(screenId: string, ids: string[]) {
  'worklet';

  for (const id of ids) {
    if (id === screenId) {
      return true;
    }
  }

  return false;
}

function screenControllerIsVisibleInNativeStack(
  stackId: string,
  controller: any,
  registry: NativeScriptStackRegistry
) {
  'worklet';

  return (
    navigationControllerContainsController(
      registry.stacks[stackId],
      controller
    ) ||
    navigationControllerContainsController(
      registry.stackModalNavigationControllers[stackId],
      controller
    )
  );
}

function cleanupDetachedScreens(
  stackId: string,
  registry: NativeScriptStackRegistry
) {
  'worklet';

  const activeIds = registry.stackActiveScreenIds[stackId] ?? [];

  for (const screenId in registry.screens) {
    if (registry.screenParents[screenId] !== stackId) {
      continue;
    }

    if (screenIdInList(screenId, activeIds)) {
      continue;
    }

    if (
      screenControllerIsVisibleInNativeStack(
        stackId,
        registry.screens[screenId],
        registry
      )
    ) {
      continue;
    }

    clearScreenRecord(registry, screenId);
  }
}

export function requestNativeScriptStackPop(screenId: string, count = 1) {
  return (NativeScriptRuntime as any)
    .runOnUI(
      (targetScreenId: string, requestedCount: number) => {
        'worklet';
        const registry = (globalThis as Record<string, any>)[REGISTRY_KEY] as
          | NativeScriptStackRegistry
          | undefined;

        if (!registry) {
          return 'no-registry';
        }

        const controller = registry.screens[targetScreenId];
        const stackId = registry.screenParents[targetScreenId];
        const navigationController = stackId ? registry.stacks[stackId] : null;

        if (!stackId || !controller || !navigationController) {
          return 'missing-stack';
        }

        if (registry.stackTransitioning[stackId]) {
          return 'transitioning';
        }

        const ctx = registry.stackContexts[stackId];
        const modalNavigationController =
          registry.stackModalNavigationControllers[stackId];
        const targetIsPresentedModal = isModalPresentation(
          registry.screenProps[targetScreenId]?.stackPresentation
        );
        if (
          modalNavigationController &&
          (targetIsPresentedModal ||
            navigationControllerContainsController(
              modalNavigationController,
              controller
            ))
        ) {
          const modalViewControllers =
            modalNavigationController.viewControllers;
          const modalCount = arrayCount(modalViewControllers);
          const modalPopCount = Math.max(
            1,
            Math.min(Math.floor(requestedCount || 1), modalCount)
          );
          const topModalController = arrayItem(
            modalViewControllers,
            modalCount - 1
          );
          const closingModalScreenId =
            screenIdForController(topModalController, registry) ??
            targetScreenId;

          if (modalCount > 1 && modalPopCount < modalCount) {
            const targetIndex = Math.max(0, modalCount - modalPopCount - 1);
            const targetController = arrayItem(
              modalViewControllers,
              targetIndex
            );
            const targetControllers = controllersThroughIndex(
              modalViewControllers,
              targetIndex
            );

            markTransition(
              stackId,
              registry,
              ctx,
              true,
              closingModalScreenId,
              true
            );

            if (
              modalPopCount === 1 &&
              typeof modalNavigationController.popViewControllerAnimated ===
                'function'
            ) {
              modalNavigationController.popViewControllerAnimated(true);
              updateNativeBackGesture(modalNavigationController);
              return 'ok';
            }

            if (
              targetController &&
              typeof modalNavigationController.popToViewControllerAnimated ===
                'function'
            ) {
              modalNavigationController.popToViewControllerAnimated(
                targetController,
                true
              );
              updateNativeBackGesture(modalNavigationController);
              return 'ok';
            }

            if (
              targetControllers.length > 0 &&
              typeof modalNavigationController.setViewControllersAnimated ===
                'function'
            ) {
              modalNavigationController.setViewControllersAnimated(
                createArray(targetControllers),
                true
              );
              updateNativeBackGesture(modalNavigationController);
              return 'ok';
            }

            finishTransition(
              stackId,
              registry,
              ctx,
              true,
              closingModalScreenId
            );
          }

          registry.stackModalDismissRequestedFromJS[stackId] = true;

          return dismissModalStack(
            stackId,
            registry,
            ctx,
            true,
            closingModalScreenId
          )
            ? 'ok-modal'
            : 'unsupported';
        }

        const viewControllers = navigationController.viewControllers;
        const nativeCount = arrayCount(viewControllers);

        if (nativeCount <= 1) {
          return 'at-root';
        }

        const popCount = Math.max(
          1,
          Math.min(Math.floor(requestedCount || 1), nativeCount - 1)
        );
        const targetIndex = Math.max(0, nativeCount - popCount - 1);
        const targetController = arrayItem(viewControllers, targetIndex);
        const targetControllers = controllersThroughIndex(
          viewControllers,
          targetIndex
        );
        const activeIds = registry.stackActiveScreenIds[stackId] ?? [];
        const nativeIds = navigationControllerScreenIds(
          navigationController,
          registry
        );
        const targetScreenIds =
          activeIds.length > popCount
            ? activeIds.slice(0, activeIds.length - popCount)
            : nativeIds.length > popCount
              ? nativeIds.slice(0, nativeIds.length - popCount)
              : nativeIds.slice(0, targetIndex + 1);
        const closingScreenId =
          activeIds[activeIds.length - 1] ??
          screenIdForController(
            arrayItem(viewControllers, nativeCount - 1),
            registry
          ) ??
          targetScreenId;
        const token = markTransition(
          stackId,
          registry,
          ctx,
          true,
          closingScreenId,
          true
        );

        if (
          popCount === 1 &&
          typeof navigationController.popViewControllerAnimated === 'function'
        ) {
          navigationController.popViewControllerAnimated(true);
        } else if (
          popCount >= nativeCount - 1 &&
          typeof navigationController.popToRootViewControllerAnimated ===
            'function'
        ) {
          navigationController.popToRootViewControllerAnimated(true);
        } else if (
          targetController &&
          typeof navigationController.popToViewControllerAnimated === 'function'
        ) {
          navigationController.popToViewControllerAnimated(
            targetController,
            true
          );
        } else if (
          targetControllers.length > 0 &&
          typeof navigationController.setViewControllersAnimated === 'function'
        ) {
          navigationController.setViewControllersAnimated(
            createArray(targetControllers),
            true
          );
        } else if (
          typeof navigationController.popViewControllerAnimated === 'function'
        ) {
          navigationController.popViewControllerAnimated(true);
        } else {
          finishTransition(stackId, registry, ctx, true, closingScreenId);
          return 'unsupported';
        }

        updateNativeBackGesture(navigationController);
        scheduleTransitionFallback(
          stackId,
          registry,
          ctx,
          token,
          true,
          closingScreenId,
          targetScreenIds,
          navigationController,
          true
        );
        return 'ok';
      },
      screenId,
      count
    )
    .catch(() => 'error');
}

export function repairNativeScriptStackAfterDismiss(screenId: string) {
  return (NativeScriptRuntime as any)
    .runOnUI((dismissedScreenId: string) => {
      'worklet';
      const registry = (globalThis as Record<string, any>)[REGISTRY_KEY] as
        | NativeScriptStackRegistry
        | undefined;

      if (!registry) {
        return 'no-registry';
      }

      const stackId = registry.screenParents[dismissedScreenId];
      const navigationController = stackId ? registry.stacks[stackId] : null;
      const ctx = stackId ? registry.stackContexts[stackId] : null;

      if (!stackId || !navigationController) {
        return 'missing-stack';
      }

      const activeIds = registry.stackActiveScreenIds[stackId] ?? [];
      const target = controllersForIds(activeIds, registry);

      if (
        target.availableIds.length === 0 ||
        target.availableIds.length !== activeIds.length
      ) {
        return 'missing-controllers';
      }

      setNavigationControllerViewControllers(
        navigationController,
        target.controllers,
        false
      );
      registry.stackNativeKeys[stackId] = idsKey(target.availableIds);
      registry.stackNativeCounts[stackId] = target.availableIds.length;
      layoutNavigationStackViews(navigationController);
      configureStackControllers(target.availableIds, registry);
      configureNavigationAppearance(
        navigationController,
        registry.screenHeaderConfigs[
          target.availableIds[target.availableIds.length - 1]
        ]
      );
      updateNativeBackGesture(navigationController);
      cleanupDetachedScreens(stackId, registry);

      if (ctx) {
        scheduleStackChange(ctx);
      }

      return 'ok';
    }, screenId)
    .catch(() => 'error');
}

function navigationControllerScreenIds(
  navigationController: any,
  registry: NativeScriptStackRegistry
) {
  'worklet';
  const ids: string[] = [];
  const viewControllers = navigationController?.viewControllers;
  const count = arrayCount(viewControllers);

  for (let index = 0; index < count; index += 1) {
    const screenId = screenIdForController(
      arrayItem(viewControllers, index),
      registry
    );

    if (screenId) {
      ids.push(screenId);
    }
  }

  return ids;
}

function stackVisibleScreenIds(
  stackId: string,
  registry: NativeScriptStackRegistry
) {
  'worklet';
  const navigationController = registry.stacks[stackId];
  const ids = navigationControllerScreenIds(navigationController, registry);
  const modalNavigationController =
    registry.stackModalNavigationControllers[stackId];

  if (modalNavigationController) {
    const modalIds = navigationControllerScreenIds(
      modalNavigationController,
      registry
    );

    for (const modalId of modalIds) {
      ids.push(modalId);
    }
  }

  return ids;
}

function firstModalIndex(ids: string[], registry: NativeScriptStackRegistry) {
  'worklet';

  for (let index = 1; index < ids.length; index += 1) {
    if (
      isModalPresentation(registry.screenProps[ids[index]]?.stackPresentation)
    ) {
      return index;
    }
  }

  return -1;
}

function idsEqual(left: string[], right: string[]) {
  'worklet';

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function shouldEmitNativeStackChange(shownIds: string[], activeIds: string[]) {
  'worklet';

  if (shownIds.length === 0 || shownIds.length >= activeIds.length) {
    return false;
  }

  for (let index = 0; index < shownIds.length; index += 1) {
    if (shownIds[index] !== activeIds[index]) {
      return false;
    }
  }

  return true;
}

function idsFromKey(key: string | undefined) {
  'worklet';

  if (!key) {
    return [];
  }

  return key.split(SCREEN_ID_SEPARATOR);
}

function idsKey(ids: string[]) {
  'worklet';

  return ids.join(SCREEN_ID_SEPARATOR);
}

function controllersForIds(ids: string[], registry: NativeScriptStackRegistry) {
  'worklet';
  const controllers: any[] = [];
  const availableIds: string[] = [];

  for (const id of ids) {
    const controller = registry.screens[id];

    if (controller) {
      controllers.push(controller);
      availableIds.push(id);
    }
  }

  return { availableIds, controllers };
}

function controllersThroughIndex(viewControllers: any, targetIndex: number) {
  'worklet';
  const controllers: any[] = [];
  const count = arrayCount(viewControllers);
  const lastIndex = Math.min(Math.max(0, targetIndex), count - 1);

  for (let index = 0; index <= lastIndex; index += 1) {
    const controller = arrayItem(viewControllers, index);

    if (controller) {
      controllers.push(controller);
    }
  }

  return controllers;
}

function rectWithY(rect: any, y: number) {
  'worklet';
  const origin = rect?.origin;
  const size = rect?.size;
  const CGRectMake = nativeValue('CGRectMake');
  const x = origin?.x ?? 0;
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;

  if (typeof CGRectMake === 'function') {
    return CGRectMake(x, y, width, height);
  }

  return {
    origin: { x, y },
    size: { height, width },
  };
}

function animateWithDuration(
  duration: number,
  animations: () => void,
  completion: () => void
) {
  'worklet';
  const UIView = nativeValue('UIView');

  if (
    UIView &&
    typeof UIView.animateWithDurationAnimationsCompletion === 'function'
  ) {
    UIView.animateWithDurationAnimationsCompletion(
      duration,
      animations,
      completion
    );
    return;
  }

  animations();
  completion();
}

function updateNativeBackGesture(navigationController: any) {
  'worklet';
  const gesture = navigationController?.interactivePopGestureRecognizer;

  if (!gesture) {
    return;
  }

  const count = arrayCount(navigationController.viewControllers);

  gesture.enabled = count > 1;
}

function installNativeBackGestureDelegate(navigationController: any, ctx: any) {
  'worklet';
  const gesture = navigationController?.interactivePopGestureRecognizer;

  if (!gesture || !ctx) {
    return;
  }

  const delegateProtocol =
    nativeValue('UIGestureRecognizerDelegate') ?? 'UIGestureRecognizerDelegate';

  const delegate = ctx.delegate(gesture, delegateProtocol, {
    gestureRecognizerShouldBegin() {
      'worklet';

      return arrayCount(navigationController.viewControllers) > 1;
    },
    gestureRecognizerShouldRecognizeSimultaneouslyWithGestureRecognizer() {
      'worklet';

      return true;
    },
  });
  gesture.delegate = delegate;

  updateNativeBackGesture(navigationController);
}

function configureNavigationAppearance(
  navigationController: any,
  headerConfig?: ScreenStackHeaderConfigProps
) {
  'worklet';

  if (!navigationController) {
    return;
  }

  configureExtendedLayout(navigationController);
  updateNativeBackGesture(navigationController);
  layoutNavigationStackViews(navigationController);

  const viewControllers = navigationController.viewControllers;
  const count = arrayCount(viewControllers);

  if (count >= 2) {
    const previousController = arrayItem(viewControllers, count - 2);
    const navigationItem = previousController?.navigationItem;

    configureSourceBackButton(navigationItem, headerConfig);
  } else if (count === 1) {
    const rootController = arrayItem(viewControllers, 0);
    const navigationItem = rootController?.navigationItem;

    if (navigationItem) {
      navigationItem.backBarButtonItem = null;
      navigationItem.backButtonTitle = '';
      navigationItem.hidesBackButton = true;
    }
  }

  const navigationBar = navigationController.navigationBar;

  if (!navigationBar) {
    return;
  }

  const hidden = headerConfig?.hidden === true;

  if (
    typeof navigationController.setNavigationBarHiddenAnimated === 'function'
  ) {
    navigationController.setNavigationBarHiddenAnimated(hidden, false);
  }

  navigationController.navigationBarHidden = hidden;
  navigationBar.hidden = hidden;
  navigationBar.prefersLargeTitles = headerConfig?.largeTitle === true;
  navigationBar.translucent = headerConfig?.translucent !== false;

  const tintColor = nativeColor(headerConfig?.color, 'labelColor');

  if (tintColor) {
    navigationBar.tintColor = tintColor;
  }

  const clearColor = nativeColor('transparent', 'clearColor');
  const backgroundColor = nativeColor(
    headerConfig?.backgroundColor,
    'systemBackgroundColor'
  );
  const shouldUseTransparentBackground =
    headerConfig?.translucent === true ||
    headerConfig?.backgroundColor === 'transparent';
  const UINavigationBarAppearance = nativeValue('UINavigationBarAppearance');

  if (
    UINavigationBarAppearance &&
    typeof UINavigationBarAppearance.alloc === 'function'
  ) {
    const allocated = UINavigationBarAppearance.alloc();
    const appearance =
      allocated && typeof allocated.init === 'function'
        ? allocated.init()
        : allocated;

    if (
      shouldUseTransparentBackground &&
      typeof appearance.configureWithTransparentBackground === 'function'
    ) {
      appearance.configureWithTransparentBackground();
    } else if (
      typeof appearance.configureWithDefaultBackground === 'function'
    ) {
      appearance.configureWithDefaultBackground();
    }

    if (backgroundColor) {
      appearance.backgroundColor = backgroundColor;
    }

    if (clearColor && headerConfig?.hideShadow === true) {
      appearance.shadowColor = clearColor;
    }

    navigationBar.standardAppearance = appearance;
    navigationBar.scrollEdgeAppearance = appearance;
    navigationBar.compactAppearance = appearance;
  } else if (backgroundColor) {
    navigationBar.backgroundColor = backgroundColor;
  }
}

function configureScreenController(
  controller: any,
  props: Readonly<NativeScriptScreenStackItemProps>,
  ctx?: any,
  isTopScreen = false,
  canGoBack = false
) {
  'worklet';

  setScreenControllerIdentity(controller, props.screenId);
  configureExtendedLayout(controller);

  const headerConfig = props.headerConfig;
  const navigationItem = controller?.navigationItem;

  controller.title = headerConfig?.title ?? '';

  if (controller.view) {
    controller.view.autoresizingMask = flexibleSizeMask();
    controller.view.backgroundColor = nativeColor(
      headerConfig?.backgroundColor,
      'systemBackgroundColor'
    );
    layoutHostedReactSubviews(controller);
  }

  if (navigationItem) {
    navigationItem.title = headerConfig?.title ?? '';
    configureSourceBackButton(navigationItem, headerConfig);
    navigationItem.hidesBackButton = headerConfig?.hideBackButton === true;
    navigationItem.backButtonDisplayMode = backButtonDisplayMode(
      headerConfig?.backTitleVisible === false
        ? 'minimal'
        : headerConfig?.backButtonDisplayMode
    );
    navigationItem.largeTitleDisplayMode = largeTitleDisplayMode(
      headerConfig?.largeTitle === true
    );
  }

  const navigationController = controller.navigationController;

  if (navigationController) {
    configureNavigationAppearance(navigationController, headerConfig);
    layoutNavigationStackViews(navigationController);
  }

  configureHeaderBackButton(controller, props, isTopScreen, canGoBack);
  emitHeaderHeightChange(controller, props, ctx);
}

function configureStackControllers(
  ids: string[],
  registry: NativeScriptStackRegistry
) {
  'worklet';

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    const controller = registry.screens[id];
    const props = registry.screenProps[id];

    if (!controller || !props) {
      continue;
    }

    configureScreenController(
      controller,
      props,
      registry.screenContexts[id],
      index === ids.length - 1,
      index > 0
    );
  }
}

function emitStackChangeForIds(ctx: any, screenIds: string[]) {
  'worklet';

  if (!ctx?.props?.stackId) {
    return;
  }

  ctx.emit('onNativeStackChange', {
    nativeEvent: {
      screenIds,
    },
  });
}

function emitStackChange(ctx: any) {
  'worklet';

  if (!ctx?.props?.stackId) {
    return;
  }

  const registry = getRegistry(globalThis as Record<string, any>);
  const screenIds = stackVisibleScreenIds(ctx.props.stackId, registry);

  emitStackChangeForIds(ctx, screenIds);
}

function scheduleStackChange(ctx: any) {
  'worklet';

  emitStackChange(ctx);

  if (typeof setTimeout !== 'function') {
    return;
  }

  const emit = () => {
    'worklet';
    emitStackChange(ctx);
  };

  setTimeout(emit, 0);
  setTimeout(emit, 64);
  setTimeout(emit, 160);
}

function emitTransition(
  ctx: any,
  phase: 'start' | 'end',
  closing: boolean,
  screenId: string | undefined
) {
  'worklet';

  if (!ctx || !screenId) {
    return;
  }

  ctx.emit('onNativeStackTransition', {
    nativeEvent: {
      closing,
      phase,
      screenId,
    },
  });
}

function emitScreenDismissed(
  registry: NativeScriptStackRegistry,
  screenId: string | undefined,
  dismissCount: number
) {
  'worklet';

  if (!screenId) {
    return;
  }

  registry.screenContexts[screenId]?.emit?.('onDismissed', {
    nativeEvent: {
      dismissCount,
    },
  });
}

function markTransition(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  closing: boolean,
  screenId: string | undefined,
  nativeDriven = false
) {
  'worklet';
  const token = (registry.stackTransitionTokens[stackId] ?? 0) + 1;

  registry.stackTransitionTokens[stackId] = token;
  registry.stackTransitioning[stackId] = true;
  registry.stackTransitionClosing[stackId] = closing;
  registry.stackTransitionNativeDriven[stackId] = nativeDriven;
  registry.stackTransitionScreenIds[stackId] = screenId;
  emitTransition(ctx, 'start', closing, screenId);

  return token;
}

function animateStackPush(parent: any, controller: any) {
  'worklet';

  if (!controller || typeof parent?.pushViewControllerAnimated !== 'function') {
    return false;
  }

  parent.pushViewControllerAnimated(controller, true);

  return true;
}

function animateStackPop(
  parent: any,
  controllers: any[],
  targetController: any,
  nextCount: number,
  previousCount: number
) {
  'worklet';

  if (!parent) {
    return false;
  }

  if (
    nextCount === previousCount - 1 &&
    typeof parent.popViewControllerAnimated === 'function'
  ) {
    parent.popViewControllerAnimated(true);

    return true;
  }

  if (
    nextCount === 1 &&
    previousCount > 1 &&
    typeof parent.popToRootViewControllerAnimated === 'function'
  ) {
    parent.popToRootViewControllerAnimated(true);

    return true;
  }

  if (
    targetController &&
    typeof parent.popToViewControllerAnimated === 'function'
  ) {
    parent.popToViewControllerAnimated(targetController, true);

    return true;
  }

  if (
    controllers.length > 0 &&
    typeof parent.setViewControllersAnimated === 'function'
  ) {
    parent.setViewControllersAnimated(createArray(controllers), true);

    return true;
  }

  if (typeof parent.popViewControllerAnimated === 'function') {
    const nativeControllers = parent.viewControllers;
    const topController =
      parent.topViewController ??
      arrayItem(nativeControllers, arrayCount(nativeControllers) - 1);

    if (
      topController &&
      typeof parent.setViewControllersAnimated === 'function'
    ) {
      parent.setViewControllersAnimated(
        createArray([...controllers, topController]),
        false
      );
      parent.popViewControllerAnimated(true);

      return true;
    }
  }

  return false;
}

function setNavigationControllerViewControllers(
  navigationController: any,
  controllers: any[],
  animated: boolean
) {
  'worklet';
  const nativeControllers = createArray(controllers);

  if (navigationController && !animated) {
    const currentCount = arrayCount(navigationController.viewControllers);

    if (
      controllers.length > 1 &&
      typeof navigationController.pushViewControllerAnimated === 'function'
    ) {
      const rootControllers = createArray([controllers[0]]);

      if (
        typeof navigationController.setViewControllersAnimated === 'function'
      ) {
        navigationController.setViewControllersAnimated(rootControllers, false);
      }

      navigationController.viewControllers = rootControllers;

      for (let index = 1; index < controllers.length; index += 1) {
        const controller = controllers[index];

        if (controller) {
          navigationController.pushViewControllerAnimated(controller, false);
        }
      }

      return;
    }

    if (
      controllers.length > currentCount &&
      typeof navigationController.pushViewControllerAnimated === 'function'
    ) {
      for (let index = currentCount; index < controllers.length; index += 1) {
        const controller = controllers[index];

        if (controller) {
          navigationController.pushViewControllerAnimated(controller, false);
        }
      }

      return;
    }

    if (controllers.length > 0 && controllers.length < currentCount) {
      const targetController = controllers[controllers.length - 1];

      if (
        controllers.length === 1 &&
        typeof navigationController.popToRootViewControllerAnimated ===
          'function'
      ) {
        navigationController.popToRootViewControllerAnimated(false);
      } else if (
        targetController &&
        typeof navigationController.popToViewControllerAnimated === 'function'
      ) {
        navigationController.popToViewControllerAnimated(
          targetController,
          false
        );
      }
    }
  }

  if (
    navigationController &&
    typeof navigationController.setViewControllersAnimated === 'function'
  ) {
    navigationController.setViewControllersAnimated(
      nativeControllers,
      animated
    );
  }

  if (navigationController && !animated) {
    navigationController.viewControllers = nativeControllers;
  } else if (
    navigationController &&
    typeof navigationController.setViewControllersAnimated !== 'function'
  ) {
    navigationController.viewControllers = nativeControllers;
  }
}

function finishTransition(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  closing: boolean,
  screenId: string | undefined,
  emitStackChange = false
) {
  'worklet';

  emitTransition(ctx, 'end', closing, screenId);
  registry.stackTransitioning[stackId] = false;
  registry.stackTransitionClosing[stackId] = undefined;
  registry.stackTransitionNativeDriven[stackId] = undefined;
  registry.stackTransitionScreenIds[stackId] = undefined;
  registry.stackTransitionTokens[stackId] =
    (registry.stackTransitionTokens[stackId] ?? 0) + 1;

  if (emitStackChange) {
    scheduleStackChange(ctx);
  }

  cleanupDetachedScreens(stackId, registry);
}

function scheduleTransitionFallback(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  token: number,
  closing: boolean,
  screenId: string | undefined,
  targetIds: string[],
  navigationController: any,
  emitStackChange: boolean
) {
  'worklet';

  if (typeof setTimeout !== 'function') {
    return;
  }

  const complete = () => {
    'worklet';
    const currentToken = registry.stackTransitionTokens[stackId];

    if (currentToken !== token && currentToken !== token + 1) {
      return;
    }

    const target = controllersForIds(targetIds, registry);

    if (
      navigationController &&
      target.availableIds.length > 0 &&
      target.availableIds.length === targetIds.length
    ) {
      setNavigationControllerViewControllers(
        navigationController,
        target.controllers,
        false
      );
      registry.stackNativeKeys[stackId] = idsKey(target.availableIds);
      registry.stackNativeCounts[stackId] = target.availableIds.length;
      layoutNavigationStackViews(navigationController);
      configureStackControllers(target.availableIds, registry);
      configureNavigationAppearance(
        navigationController,
        registry.screenHeaderConfigs[
          target.availableIds[target.availableIds.length - 1]
        ]
      );
      updateNativeBackGesture(navigationController);
    }

    if (registry.stackTransitioning[stackId] === true) {
      finishTransition(
        stackId,
        registry,
        ctx,
        closing,
        screenId,
        emitStackChange
      );
    }
  };

  setTimeout(complete, 420);
}

function configureModalNavigationController(
  navigationController: any,
  presentation: unknown
) {
  'worklet';

  if (!navigationController) {
    return;
  }

  configureExtendedLayout(navigationController);
  navigationController.modalPresentationStyle =
    modalPresentationStyle(presentation);
  navigationController.modalTransitionStyle = modalTransitionStyle();
}

function createNavigationController(controllers: any[]) {
  'worklet';
  const UINavigationController = nativeValue('UINavigationController');

  if (
    !UINavigationController ||
    typeof UINavigationController.alloc !== 'function'
  ) {
    return null;
  }

  const allocated = UINavigationController.alloc();
  const navigationController =
    allocated && typeof allocated.init === 'function'
      ? allocated.init()
      : allocated;

  setNavigationControllerViewControllers(
    navigationController,
    controllers,
    false
  );

  return navigationController;
}

function presentModalStack(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  parentNavigationController: any,
  modalIds: string[],
  modalControllers: any[],
  animated: boolean
) {
  'worklet';
  const modalNavigationController =
    createNavigationController(modalControllers);
  const rootScreenId = modalIds[0];
  const rootProps = registry.screenProps[rootScreenId];

  if (
    !modalNavigationController ||
    !parentNavigationController?.view ||
    typeof parentNavigationController.addChildViewController !== 'function'
  ) {
    return false;
  }

  configureModalNavigationController(
    modalNavigationController,
    rootProps?.stackPresentation
  );
  installNativeBackGestureDelegate(modalNavigationController, ctx);
  registry.stackModalNavigationControllers[stackId] = modalNavigationController;
  registry.stackModalKeys[stackId] = idsKey(modalIds);

  const hostController =
    parentNavigationController.tabBarController ?? parentNavigationController;
  const hostView = hostController.view;
  const finalFrame = hostView.bounds;
  const height = finalFrame?.size?.height ?? 0;
  modalNavigationController.view.tag = MODAL_VIEW_TAG;
  modalNavigationController.view.autoresizingMask = flexibleSizeMask();

  configureStackControllers(modalIds, registry);
  configureNavigationAppearance(
    modalNavigationController,
    registry.screenHeaderConfigs[modalIds[modalIds.length - 1]]
  );
  markTransition(stackId, registry, ctx, false, rootScreenId);

  const complete = () => {
    'worklet';
    layoutNavigationStackViews(modalNavigationController);
    configureStackControllers(modalIds, registry);
    configureNavigationAppearance(
      modalNavigationController,
      registry.screenHeaderConfigs[modalIds[modalIds.length - 1]]
    );
    finishTransition(stackId, registry, ctx, false, rootScreenId);
  };

  if (
    typeof hostController.presentViewControllerAnimatedCompletion === 'function'
  ) {
    registry.stackModalPresentedModally[stackId] = true;
    hostController.presentViewControllerAnimatedCompletion(
      modalNavigationController,
      animated,
      complete
    );

    return true;
  }

  registry.stackModalPresentedModally[stackId] = false;
  modalNavigationController.view.tag = MODAL_VIEW_TAG;
  modalNavigationController.view.frame = animated
    ? rectWithY(finalFrame, height)
    : finalFrame;
  modalNavigationController.view.autoresizingMask = flexibleSizeMask();
  hostController.addChildViewController(modalNavigationController);
  hostView.addSubview(modalNavigationController.view);
  if (typeof hostView.bringSubviewToFront === 'function') {
    hostView.bringSubviewToFront(modalNavigationController.view);
  }
  if (
    typeof modalNavigationController.didMoveToParentViewController ===
    'function'
  ) {
    modalNavigationController.didMoveToParentViewController(hostController);
  }

  animateWithDuration(
    animated ? 0.32 : 0,
    () => {
      'worklet';
      modalNavigationController.view.frame = finalFrame;
    },
    complete
  );

  return true;
}

function dismissModalStack(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  animated: boolean,
  closingScreenId: string | undefined
) {
  'worklet';
  const modalNavigationController =
    registry.stackModalNavigationControllers[stackId];

  if (!modalNavigationController) {
    return false;
  }

  const dismissCount = Math.max(
    1,
    arrayCount(modalNavigationController.viewControllers)
  );
  const wasPresentedModally =
    registry.stackModalPresentedModally[stackId] === true;
  let didCompleteDismissal = false;
  const complete = () => {
    'worklet';
    if (didCompleteDismissal) {
      return;
    }

    didCompleteDismissal = true;

    const parentView = modalNavigationController.view?.superview;

    if (wasPresentedModally && modalNavigationController.view) {
      modalNavigationController.view.userInteractionEnabled = false;
      modalNavigationController.view.hidden = true;

      if (
        typeof modalNavigationController.view.removeFromSuperview === 'function'
      ) {
        modalNavigationController.view.removeFromSuperview();
      }
    }

    if (!wasPresentedModally) {
      if (
        typeof modalNavigationController.willMoveToParentViewController ===
        'function'
      ) {
        modalNavigationController.willMoveToParentViewController(null);
      }

      if (modalNavigationController.view) {
        modalNavigationController.view.userInteractionEnabled = false;
        modalNavigationController.view.hidden = true;

        if (finalFrame) {
          modalNavigationController.view.frame = rectWithY(finalFrame, height);
        }

        if (
          typeof modalNavigationController.view.removeFromSuperview ===
          'function'
        ) {
          modalNavigationController.view.removeFromSuperview();
        }
      }

      if (
        typeof modalNavigationController.removeFromParentViewController ===
        'function'
      ) {
        modalNavigationController.removeFromParentViewController();
      }
    }

    const cleanupTaggedModalViews = () => {
      'worklet';
      removeTaggedSubviews(parentView, MODAL_VIEW_TAG);
      removeTaggedSubviews(
        registry.stacks[stackId]?.view?.window,
        MODAL_VIEW_TAG
      );
    };

    cleanupTaggedModalViews();
    if (typeof setTimeout === 'function') {
      setTimeout(cleanupTaggedModalViews, 0);
      setTimeout(cleanupTaggedModalViews, 64);
      setTimeout(cleanupTaggedModalViews, 250);
    }
    registry.stackModalNavigationControllers[stackId] = undefined;
    registry.stackModalKeys[stackId] = undefined;
    registry.stackModalPresentedModally[stackId] = undefined;
    const shouldEmitDismissed =
      registry.stackModalDismissRequestedFromJS[stackId] !== true;
    registry.stackModalDismissRequestedFromJS[stackId] = undefined;

    const baseScreenIds = (registry.stackActiveScreenIds[stackId] ?? []).filter(
      (screenId) =>
        !isModalPresentation(registry.screenProps[screenId]?.stackPresentation)
    );
    const base = controllersForIds(baseScreenIds, registry);
    const baseNavigationController = registry.stacks[stackId];

    if (baseNavigationController && base.availableIds.length > 0) {
      const hostController =
        baseNavigationController.tabBarController ?? baseNavigationController;

      if (hostController?.view) {
        hostController.view.hidden = false;
        hostController.view.alpha = 1;
        hostController.view.userInteractionEnabled = true;
      }

      if (baseNavigationController.view) {
        baseNavigationController.view.hidden = false;
        baseNavigationController.view.alpha = 1;
        baseNavigationController.view.userInteractionEnabled = true;
      }

      setNavigationControllerViewControllers(
        baseNavigationController,
        base.controllers,
        false
      );
      registry.stackNativeKeys[stackId] = idsKey(base.availableIds);
      registry.stackNativeCounts[stackId] = base.availableIds.length;
      layoutNavigationStackViews(baseNavigationController);
      if (
        baseNavigationController.view &&
        typeof baseNavigationController.view.setNeedsLayout === 'function'
      ) {
        baseNavigationController.view.setNeedsLayout();
      }
      if (
        baseNavigationController.view &&
        typeof baseNavigationController.view.layoutIfNeeded === 'function'
      ) {
        baseNavigationController.view.layoutIfNeeded();
      }
      configureStackControllers(base.availableIds, registry);
      configureNavigationAppearance(
        baseNavigationController,
        registry.screenHeaderConfigs[
          base.availableIds[base.availableIds.length - 1]
        ]
      );
      updateNativeBackGesture(baseNavigationController);
    }

    emitTransition(ctx, 'start', true, closingScreenId);
    emitTransition(ctx, 'end', true, closingScreenId);
    if (shouldEmitDismissed) {
      emitScreenDismissed(registry, closingScreenId, dismissCount);
    }
    cleanupDetachedScreens(stackId, registry);
  };

  const parentView = modalNavigationController.view?.superview;
  const finalFrame =
    parentView?.bounds ?? modalNavigationController.view?.frame;
  const height = finalFrame?.size?.height ?? 0;

  if (
    wasPresentedModally &&
    typeof modalNavigationController.dismissViewControllerAnimatedCompletion ===
      'function'
  ) {
    modalNavigationController.dismissViewControllerAnimatedCompletion(
      animated,
      complete
    );

    if (typeof setTimeout === 'function') {
      setTimeout(complete, animated ? 420 : 0);
      setTimeout(complete, 700);
    }

    return true;
  }

  animateWithDuration(
    animated ? 0.28 : 0,
    () => {
      'worklet';
      if (modalNavigationController.view && finalFrame) {
        modalNavigationController.view.frame = rectWithY(finalFrame, height);
      }
    },
    complete
  );

  return true;
}

function reconcilePresentedModalStack(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  availableIds: string[],
  modalIndex: number,
  animated: boolean
) {
  'worklet';
  const navigationController = registry.stacks[stackId];
  const baseIds = availableIds.slice(0, modalIndex);
  const modalIds = availableIds.slice(modalIndex);
  const base = controllersForIds(baseIds, registry);
  const modal = controllersForIds(modalIds, registry);

  if (
    !navigationController ||
    base.availableIds.length !== baseIds.length ||
    modal.availableIds.length !== modalIds.length
  ) {
    return false;
  }

  const baseNativeIds = navigationControllerScreenIds(
    navigationController,
    registry
  );

  if (!idsEqual(baseNativeIds, baseIds)) {
    setNavigationControllerViewControllers(
      navigationController,
      base.controllers,
      false
    );
  }

  layoutNavigationStackViews(navigationController);
  configureStackControllers(baseIds, registry);
  configureNavigationAppearance(
    navigationController,
    registry.screenHeaderConfigs[baseIds[baseIds.length - 1]]
  );

  const modalKey = idsKey(modalIds);
  const modalNavigationController =
    registry.stackModalNavigationControllers[stackId];

  registry.stackNativeKeys[stackId] = idsKey(availableIds);
  registry.stackNativeCounts[stackId] = availableIds.length;

  if (!modalNavigationController) {
    if (arrayCount(modal.controllers[0]?.view?.subviews) === 0) {
      const retries = registry.stackPendingContentRetries[stackId] ?? 0;

      if (retries < 12) {
        registry.stackPendingContentRetries[stackId] = retries + 1;
        return true;
      }

      registry.stackPendingContentRetries[stackId] = undefined;
    } else {
      registry.stackPendingContentRetries[stackId] = undefined;
    }

    return presentModalStack(
      stackId,
      registry,
      ctx,
      navigationController,
      modalIds,
      modal.controllers,
      animated
    );
  }

  const modalNativeIds = navigationControllerScreenIds(
    modalNavigationController,
    registry
  );

  if (!idsEqual(modalNativeIds, modalIds)) {
    setNavigationControllerViewControllers(
      modalNavigationController,
      modal.controllers,
      animated
    );
  }

  registry.stackModalKeys[stackId] = modalKey;
  layoutNavigationStackViews(modalNavigationController);
  configureStackControllers(modalIds, registry);
  configureNavigationAppearance(
    modalNavigationController,
    registry.screenHeaderConfigs[modalIds[modalIds.length - 1]]
  );
  scheduleStackChange(ctx);

  return true;
}

function controllerHasReactContent(controller: any) {
  'worklet';

  return arrayCount(controller?.view?.subviews) > 0;
}

function shouldDelayPushUntilControllerHasContent(
  stackId: string,
  registry: NativeScriptStackRegistry,
  controller: any
) {
  'worklet';

  if (controllerHasReactContent(controller)) {
    registry.stackPendingContentRetries[stackId] = undefined;
    return false;
  }

  const retries = registry.stackPendingContentRetries[stackId] ?? 0;

  if (retries >= 4) {
    registry.stackPendingContentRetries[stackId] = undefined;
    return false;
  }

  registry.stackPendingContentRetries[stackId] = retries + 1;

  return true;
}

function reconcileStack(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  animated: boolean
) {
  'worklet';
  const navigationController = registry.stacks[stackId];
  const requestedIds = registry.stackActiveScreenIds[stackId] ?? [];
  const { availableIds, controllers } = controllersForIds(
    requestedIds,
    registry
  );
  const nextCount = controllers.length;

  if (!navigationController || nextCount === 0) {
    return;
  }

  if (registry.stackTransitioning[stackId]) {
    updateNativeBackGesture(navigationController);
    return;
  }

  const previousKey = registry.stackNativeKeys[stackId];
  const previousIds = idsFromKey(previousKey);
  const previousCount = registry.stackNativeCounts[stackId] ?? 0;
  const nextKey = idsKey(availableIds);
  const didChange = previousKey !== nextKey;
  const nativeIds = navigationControllerScreenIds(
    navigationController,
    registry
  );
  const modalIndex = firstModalIndex(availableIds, registry);

  if (modalIndex > 0) {
    if (
      reconcilePresentedModalStack(
        stackId,
        registry,
        ctx,
        availableIds,
        modalIndex,
        animated
      )
    ) {
      return;
    }
  }

  if (registry.stackModalNavigationControllers[stackId]) {
    if (didChange) {
      registry.stackNativeKeys[stackId] = nextKey;
      registry.stackNativeCounts[stackId] = nextCount;
    }

    const modalIds = idsFromKey(registry.stackModalKeys[stackId]);
    const closingScreenId =
      modalIds[modalIds.length - 1] ?? previousIds[previousIds.length - 1];

    if (dismissModalStack(stackId, registry, ctx, animated, closingScreenId)) {
      layoutNavigationStackViews(navigationController);
      configureStackControllers(availableIds, registry);
      configureNavigationAppearance(
        navigationController,
        registry.screenHeaderConfigs[availableIds[nextCount - 1]]
      );
      updateNativeBackGesture(navigationController);

      return;
    }
  }

  if (!didChange && idsEqual(nativeIds, availableIds)) {
    updateNativeBackGesture(navigationController);
    layoutNavigationStackViews(navigationController);
    configureStackControllers(availableIds, registry);
    configureNavigationAppearance(
      navigationController,
      registry.screenHeaderConfigs[availableIds[nextCount - 1]]
    );
    return;
  }

  if (didChange) {
    registry.stackNativeKeys[stackId] = nextKey;
    registry.stackNativeCounts[stackId] = nextCount;
  }

  if (animated && previousKey != null && previousCount > 0) {
    const isPush =
      nextCount === previousCount + 1 &&
      idsEqual(previousIds, availableIds.slice(0, previousCount));
    const isPushFromNativeStack =
      nativeIds.length > 0 &&
      nextCount === nativeIds.length + 1 &&
      idsEqual(nativeIds, availableIds.slice(0, nativeIds.length));
    const isPop =
      nextCount < previousCount &&
      idsEqual(availableIds, previousIds.slice(0, nextCount));

    if (
      (isPush || isPushFromNativeStack) &&
      nativeIds.length <= previousCount
    ) {
      const pushedScreenId = availableIds[nextCount - 1];
      const pushedController = controllers[nextCount - 1];

      if (
        shouldDelayPushUntilControllerHasContent(
          stackId,
          registry,
          pushedController
        )
      ) {
        return;
      }

      const token = markTransition(
        stackId,
        registry,
        ctx,
        false,
        pushedScreenId
      );
      configureScreenController(
        pushedController,
        registry.screenProps[pushedScreenId]!,
        registry.screenContexts[pushedScreenId],
        true,
        nextCount > 1
      );
      if (nextCount > 1) {
        configureSourceBackButton(
          controllers[nextCount - 2]?.navigationItem,
          registry.screenHeaderConfigs[pushedScreenId]
        );
      }

      if (animateStackPush(navigationController, pushedController)) {
        updateNativeBackGesture(navigationController);
        scheduleTransitionFallback(
          stackId,
          registry,
          ctx,
          token,
          false,
          pushedScreenId,
          availableIds,
          navigationController,
          false
        );

        return;
      }

      registry.stackTransitioning[stackId] = false;
      registry.stackTransitionClosing[stackId] = undefined;
      registry.stackTransitionNativeDriven[stackId] = undefined;
      registry.stackTransitionScreenIds[stackId] = undefined;
    }

    if (isPop && nativeIds.length > nextCount) {
      const poppedScreenId = previousIds[nextCount];

      const token = markTransition(
        stackId,
        registry,
        ctx,
        true,
        poppedScreenId
      );
      if (
        animateStackPop(
          navigationController,
          controllers,
          controllers[nextCount - 1],
          nextCount,
          previousCount
        )
      ) {
        updateNativeBackGesture(navigationController);
        scheduleTransitionFallback(
          stackId,
          registry,
          ctx,
          token,
          true,
          poppedScreenId,
          availableIds,
          navigationController,
          true
        );

        return;
      }

      registry.stackTransitioning[stackId] = false;
      registry.stackTransitionClosing[stackId] = undefined;
      registry.stackTransitionNativeDriven[stackId] = undefined;
      registry.stackTransitionScreenIds[stackId] = undefined;
    }
  }

  setNavigationControllerViewControllers(
    navigationController,
    controllers,
    false
  );

  layoutNavigationStackViews(navigationController);
  configureStackControllers(availableIds, registry);
  configureNavigationAppearance(
    navigationController,
    registry.screenHeaderConfigs[availableIds[nextCount - 1]]
  );
  updateNativeBackGesture(navigationController);
  cleanupDetachedScreens(stackId, registry);
}

const NativeScriptStackController = NativeScriptRuntime.defineUIViewController<
  {
    activeScreenIds: string[];
    contentRevision: number;
    onNativeStackChange?: (event: NativeStackChangeEvent) => void;
    onNativeStackTransition?: (event: NativeStackTransitionEvent) => void;
    stackId: string;
    style?: unknown;
  },
  any
>({
  debugName: 'ReactNavigationNativeScriptStackController',
  layout: { sizing: 'fill' },
  createController(ctx) {
    'worklet';
    const UIViewController = nativeValue('UIViewController');
    const UINavigationController = nativeValue('UINavigationController');

    if (!UIViewController || typeof UIViewController.alloc !== 'function') {
      throw new Error('UIViewController is not available in the UI runtime');
    }

    if (
      !UINavigationController ||
      typeof UINavigationController.alloc !== 'function'
    ) {
      throw new Error(
        'UINavigationController is not available in the UI runtime'
      );
    }

    const placeholderAllocated = UIViewController.alloc();
    const placeholder =
      placeholderAllocated && typeof placeholderAllocated.init === 'function'
        ? placeholderAllocated.init()
        : placeholderAllocated;
    const allocated = UINavigationController.alloc();
    const controller =
      allocated && typeof allocated.init === 'function'
        ? allocated.init()
        : allocated;
    const UIView = nativeValue('UIView');

    if (placeholder.view) {
      placeholder.view.backgroundColor = nativeColor(
        undefined,
        'systemBackgroundColor'
      );
    }

    configureExtendedLayout(placeholder);
    configureExtendedLayout(controller);
    configureNavigationAppearance(controller, undefined);

    if (UIView && typeof UIView.alloc === 'function') {
      const mountViewAllocated = UIView.alloc();
      const mountView =
        mountViewAllocated && typeof mountViewAllocated.init === 'function'
          ? mountViewAllocated.init()
          : mountViewAllocated;

      mountView.tag = MOUNT_VIEW_TAG;
      mountView.hidden = true;
      mountView.userInteractionEnabled = false;
      mountView.frame = controller.view.bounds;
      mountView.autoresizingMask = 18;
      controller.view.addSubview(mountView);
    }

    controller.viewControllers = createArray([placeholder]);
    installNativeBackGestureDelegate(controller, ctx);

    const delegateProtocol =
      nativeValue('UINavigationControllerDelegate') ??
      'UINavigationControllerDelegate';

    controller.delegate = ctx.delegate(controller, delegateProtocol, {
      navigationControllerWillShowViewControllerAnimated(
        navigationController: any,
        viewController: any
      ) {
        'worklet';
        const registry = getRegistry(globalThis as Record<string, any>);
        const currentIds = navigationControllerScreenIds(
          navigationController,
          registry
        );
        const nextScreenId = screenIdForController(viewController, registry);
        const nextIndex = nextScreenId ? currentIds.indexOf(nextScreenId) : -1;
        const closing =
          nextIndex >= 0 && nextIndex < Math.max(0, currentIds.length - 1);
        const activeIds =
          registry.stackActiveScreenIds[ctx.props.stackId] ?? [];
        const affectedScreenId = closing
          ? currentIds[currentIds.length - 1]
          : (nextScreenId ?? activeIds[activeIds.length - 1]);

        if (!nextScreenId) {
          return;
        }

        if (registry.stackTransitioning[ctx.props.stackId]) {
          return;
        }

        markTransition(
          ctx.props.stackId,
          registry,
          ctx,
          closing,
          affectedScreenId,
          true
        );
      },
      navigationControllerDidShowViewControllerAnimated(
        navigationController: any,
        viewController: any
      ) {
        'worklet';
        const registry = getRegistry(globalThis as Record<string, any>);
        const screenId = screenIdForController(viewController, registry);
        const shownScreenIds = navigationControllerScreenIds(
          navigationController,
          registry
        );

        if (!screenId) {
          layoutNavigationStackViews(navigationController);
          updateNativeBackGesture(navigationController);

          const activeIds =
            registry.stackActiveScreenIds[ctx.props.stackId] ?? [];
          const previousIds = idsFromKey(
            registry.stackNativeKeys[ctx.props.stackId]
          );
          const nativeCount = arrayCount(navigationController?.viewControllers);
          const isClosing =
            registry.stackTransitionClosing[ctx.props.stackId] === true;
          const fallbackScreenIds = !isClosing
            ? activeIds
            : shownScreenIds.length > 0
              ? shownScreenIds
              : nativeCount > 0 && nativeCount < activeIds.length
                ? activeIds.slice(0, nativeCount)
                : previousIds.length > 1
                  ? previousIds.slice(0, previousIds.length - 1)
                  : activeIds;
          const shouldEmitStackChange =
            shouldEmitNativeStackChange(fallbackScreenIds, activeIds) &&
            isClosing;

          if (shouldEmitStackChange) {
            const applyFallbackControllers = () => {
              'worklet';
              const fallback = controllersForIds(fallbackScreenIds, registry);

              if (
                fallback.availableIds.length === 0 ||
                fallback.availableIds.length !== fallbackScreenIds.length
              ) {
                return;
              }

              setNavigationControllerViewControllers(
                navigationController,
                fallback.controllers,
                false
              );
              layoutNavigationStackViews(navigationController);
              configureStackControllers(fallback.availableIds, registry);
              configureNavigationAppearance(
                navigationController,
                registry.screenHeaderConfigs[
                  fallback.availableIds[fallback.availableIds.length - 1]
                ]
              );
              updateNativeBackGesture(navigationController);
            };

            applyFallbackControllers();

            if (typeof setTimeout === 'function') {
              setTimeout(applyFallbackControllers, 0);
              setTimeout(applyFallbackControllers, 64);
              setTimeout(applyFallbackControllers, 250);
            }
          }

          if (registry.stackTransitioning[ctx.props.stackId] === true) {
            if (fallbackScreenIds.length > 0) {
              registry.stackNativeKeys[ctx.props.stackId] =
                idsKey(fallbackScreenIds);
              registry.stackNativeCounts[ctx.props.stackId] =
                fallbackScreenIds.length;
            }

            finishTransition(
              ctx.props.stackId,
              registry,
              ctx,
              isClosing,
              registry.stackTransitionScreenIds[ctx.props.stackId],
              registry.stackTransitionNativeDriven[ctx.props.stackId] ===
                true || shouldEmitStackChange
            );
          } else if (fallbackScreenIds.length > 0) {
            registry.stackNativeKeys[ctx.props.stackId] =
              idsKey(fallbackScreenIds);
            registry.stackNativeCounts[ctx.props.stackId] =
              fallbackScreenIds.length;
          }

          if (shouldEmitStackChange) {
            emitStackChangeForIds(ctx, fallbackScreenIds);
          }

          return;
        }

        layoutNavigationStackViews(navigationController);
        configureStackControllers(shownScreenIds, registry);
        updateNativeBackGesture(navigationController);
        configureNavigationAppearance(
          navigationController,
          registry.screenHeaderConfigs[screenId]
        );
        registry.stackNativeKeys[ctx.props.stackId] = idsKey(shownScreenIds);
        registry.stackNativeCounts[ctx.props.stackId] = shownScreenIds.length;
        const isTransitioning =
          registry.stackTransitioning[ctx.props.stackId] === true;
        const wasClosing =
          registry.stackTransitionClosing[ctx.props.stackId] === true;
        const transitionScreenId =
          registry.stackTransitionScreenIds[ctx.props.stackId] ?? screenId;
        const activeIds =
          registry.stackActiveScreenIds[ctx.props.stackId] ?? [];
        const shouldEmitStackChange =
          registry.stackTransitionNativeDriven[ctx.props.stackId] === true ||
          shouldEmitNativeStackChange(shownScreenIds, activeIds);

        if (isTransitioning) {
          finishTransition(
            ctx.props.stackId,
            registry,
            ctx,
            wasClosing,
            transitionScreenId,
            shouldEmitStackChange
          );
        } else if (shouldEmitStackChange) {
          scheduleStackChange(ctx);
        }

        if (isTransitioning && !wasClosing) {
          reconcileStack(ctx.props.stackId, registry, ctx, true);
        } else if (isTransitioning && !shouldEmitStackChange) {
          if (!idsEqual(shownScreenIds, activeIds)) {
            reconcileStack(ctx.props.stackId, registry, ctx, true);
          }
        }
      },
    });

    return controller;
  },
  childrenView(controller) {
    'worklet';
    const existingMountView =
      controller.view && typeof controller.view.viewWithTag === 'function'
        ? controller.view.viewWithTag(MOUNT_VIEW_TAG)
        : null;

    if (existingMountView) {
      return existingMountView;
    }

    return controller.view;
  },
  mounted(controller, props, ctx) {
    'worklet';
    const registry = getRegistry(globalThis as Record<string, any>);

    registry.stacks[props.stackId] = controller;
    registry.stackContexts[props.stackId] = ctx;
    registry.stackActiveScreenIds[props.stackId] = props.activeScreenIds;
    reconcileStack(props.stackId, registry, ctx, false);
  },
  update(controller, props, _previousProps, ctx) {
    'worklet';
    const registry = getRegistry(globalThis as Record<string, any>);

    registry.stacks[props.stackId] = controller;
    registry.stackContexts[props.stackId] = ctx;
    registry.stackActiveScreenIds[props.stackId] = props.activeScreenIds;
    reconcileStack(props.stackId, registry, ctx, true);
  },
  dispose(_controller, props) {
    'worklet';
    const registry = (globalThis as Record<string, any>)[REGISTRY_KEY];

    if (!registry) {
      return;
    }

    registry.stacks[props.stackId] = undefined;
    registry.stackContexts[props.stackId] = undefined;
    registry.stackActiveScreenIds[props.stackId] = undefined;
    registry.stackNativeKeys[props.stackId] = undefined;
    registry.stackNativeCounts[props.stackId] = undefined;
    registry.stackTransitioning[props.stackId] = undefined;
    registry.stackTransitionClosing[props.stackId] = undefined;
    registry.stackTransitionNativeDriven[props.stackId] = undefined;
    registry.stackTransitionScreenIds[props.stackId] = undefined;
    registry.stackTransitionTokens[props.stackId] = undefined;
    registry.stackPendingContentRetries[props.stackId] = undefined;
    registry.stackModalNavigationControllers[props.stackId] = undefined;
    registry.stackModalKeys[props.stackId] = undefined;
    registry.stackModalPresentedModally[props.stackId] = undefined;
    registry.stackModalDismissRequestedFromJS[props.stackId] = undefined;
  },
});

const NativeScriptScreenController = NativeScriptRuntime.defineUIViewController<
  NativeScriptScreenStackItemProps,
  any
>({
  debugName: 'ReactNavigationNativeScriptScreenController',
  layout: { sizing: 'fill' },
  createController(props) {
    'worklet';
    const UIViewController = nativeValue('UIViewController');

    if (!UIViewController || typeof UIViewController.alloc !== 'function') {
      throw new Error('UIViewController is not available in the UI runtime');
    }

    const allocated = UIViewController.alloc();
    const controller =
      allocated && typeof allocated.init === 'function'
        ? allocated.init()
        : allocated;

    configureScreenController(controller, props);

    return controller;
  },
  childrenView(controller) {
    'worklet';

    return controller.view;
  },
  mounted(controller, props, ctx) {
    'worklet';
    const registry = getRegistry(globalThis as Record<string, any>);

    registry.screens[props.screenId] = controller;
    registry.screenControllerHashes[props.screenId] =
      controllerHash(controller);
    registry.screenHeaderConfigs[props.screenId] = props.headerConfig;
    registry.screenContexts[props.screenId] = ctx;
    registry.screenParents[props.screenId] = props.parentId;
    registry.screenProps[props.screenId] = props;
    configureScreenController(controller, props, ctx);

    if (props.parentId) {
      const shouldAnimate = registry.stackNativeKeys[props.parentId] != null;

      reconcileStack(
        props.parentId,
        registry,
        registry.stackContexts[props.parentId],
        shouldAnimate
      );
    }
  },
  update(controller, props, _previousProps, ctx) {
    'worklet';
    const registry = getRegistry(globalThis as Record<string, any>);

    registry.screens[props.screenId] = controller;
    registry.screenControllerHashes[props.screenId] =
      controllerHash(controller);
    registry.screenHeaderConfigs[props.screenId] = props.headerConfig;
    registry.screenContexts[props.screenId] = ctx;
    registry.screenParents[props.screenId] = props.parentId;
    registry.screenProps[props.screenId] = props;
    configureScreenController(controller, props, ctx);

    if (props.parentId) {
      reconcileStack(
        props.parentId,
        registry,
        registry.stackContexts[props.parentId],
        true
      );
    }
  },
  dispose(controller, props) {
    'worklet';
    const registry = (globalThis as Record<string, any>)[REGISTRY_KEY];

    if (!registry) {
      return;
    }

    const shouldRetainForNativePop =
      props.parentId &&
      screenControllerIsVisibleInNativeStack(
        props.parentId,
        controller,
        registry
      );

    if (shouldRetainForNativePop) {
      registry.screens[props.screenId] = controller;
      registry.screenControllerHashes[props.screenId] =
        controllerHash(controller);
      registry.screenHeaderConfigs[props.screenId] = props.headerConfig;
      registry.screenParents[props.screenId] = props.parentId;
      registry.screenProps[props.screenId] = props;
    } else {
      clearScreenRecord(registry, props.screenId);
    }

    if (props.parentId) {
      reconcileStack(
        props.parentId,
        registry,
        registry.stackContexts[props.parentId],
        Boolean(shouldRetainForNativePop)
      );
    }
  },
});

export function NativeScriptScreenStack({
  children,
  onNativeStackChange,
  onNativeStackTransition,
  style,
}: NativeScriptScreenStackProps) {
  const stackId = React.useRef<string | null>(null);
  const itemPropsByScreenIdRef = React.useRef<
    Map<string, NativeScriptScreenStackItemProps>
  >(new Map());
  const registeredItemsRef = React.useRef<Map<string, RegisteredStackItem>>(
    new Map()
  );
  const nextItemOrderRef = React.useRef(0);
  const activeScreenIdsRef = React.useRef<string[]>([]);
  const [contentRevision, forceVersion] = React.useReducer(
    (value: number) => value + 1,
    0
  );

  if (stackId.current === null) {
    nextStackId += 1;
    stackId.current = `rn-ns-stack-${nextStackId}`;
  }

  const registerScreen = React.useCallback(
    (
      screenId: string,
      props: NativeScriptScreenStackItemProps,
      active: boolean
    ) => {
      const existing = registeredItemsRef.current.get(screenId);
      const order = existing?.order ?? nextItemOrderRef.current++;
      const shouldUpdate =
        !existing ||
        existing.active !== active ||
        existing.props.parentId !== props.parentId ||
        existing.props.headerConfig !== props.headerConfig ||
        existing.props.nativeScriptContentRevision !==
          props.nativeScriptContentRevision;

      registeredItemsRef.current.set(screenId, {
        active,
        order,
        props,
      });
      itemPropsByScreenIdRef.current.set(screenId, props);

      if (shouldUpdate) {
        forceVersion();
      }
    },
    []
  );

  const unregisterScreen = React.useCallback((screenId: string) => {
    const didDelete = registeredItemsRef.current.delete(screenId);
    itemPropsByScreenIdRef.current.delete(screenId);

    if (didDelete) {
      forceVersion();
    }
  }, []);

  const contextValue = React.useMemo(
    () => ({
      registerScreen,
      stackId: stackId.current!,
      unregisterScreen,
    }),
    [registerScreen, unregisterScreen]
  );

  const activeScreenIds = Array.from(registeredItemsRef.current.entries())
    .filter(([, item]) => item.active)
    .sort((left, right) => left[1].order - right[1].order)
    .map(([screenId]) => screenId);

  activeScreenIdsRef.current = activeScreenIds;

  const handleNativeStackChange = React.useCallback(
    (event: NativeStackChangeEvent) => {
      onNativeStackChange?.(event);

      const nativeScreenIds = event.nativeEvent.screenIds;
      const activeIds = activeScreenIdsRef.current;

      if (nativeScreenIds.length === 0) {
        return;
      }

      if (nativeScreenIds.length >= activeIds.length) {
        return;
      }

      for (let index = 0; index < nativeScreenIds.length; index += 1) {
        if (nativeScreenIds[index] !== activeIds[index]) {
          return;
        }
      }

      const dismissedScreenId = activeIds[nativeScreenIds.length];
      const dismissedProps =
        itemPropsByScreenIdRef.current.get(dismissedScreenId);

      dismissedProps?.onDismissed?.({
        nativeEvent: {
          dismissCount: activeIds.length - nativeScreenIds.length,
        },
      } as Parameters<NonNullable<ScreenProps['onDismissed']>>[0]);
    },
    [onNativeStackChange]
  );

  const handleNativeTransition = React.useCallback(
    (event: NativeStackTransitionEvent) => {
      onNativeStackTransition?.(event);

      const { closing, phase, screenId } = event.nativeEvent;

      const itemProps = itemPropsByScreenIdRef.current.get(screenId);

      if (!itemProps) {
        return;
      }

      if (phase === 'start') {
        if (closing) {
          itemProps.onWillDisappear?.({ nativeEvent: {} } as Parameters<
            NonNullable<ScreenProps['onWillDisappear']>
          >[0]);
        } else {
          itemProps.onWillAppear?.({ nativeEvent: {} } as Parameters<
            NonNullable<ScreenProps['onWillAppear']>
          >[0]);
        }
      } else if (closing) {
        itemProps.onDisappear?.({ nativeEvent: {} } as Parameters<
          NonNullable<ScreenProps['onDisappear']>
        >[0]);
      } else {
        itemProps.onAppear?.({ nativeEvent: {} } as Parameters<
          NonNullable<ScreenProps['onAppear']>
        >[0]);
      }
    },
    [onNativeStackTransition]
  );

  return (
    <NativeScriptScreenStackContext.Provider value={contextValue}>
      <NativeScriptStackController
        activeScreenIds={activeScreenIds}
        attachController
        contentRevision={contentRevision}
        onNativeStackChange={handleNativeStackChange}
        onNativeStackTransition={handleNativeTransition}
        stackId={stackId.current}
        style={style}
      >
        {children}
      </NativeScriptStackController>
    </NativeScriptScreenStackContext.Provider>
  );
}

export const NativeScriptScreenStackItem = React.forwardRef<
  View,
  NativeScriptScreenStackItemProps
>(function NativeScriptScreenStackItem(
  {
    children,
    contentStyle,
    headerConfig,
    onHeaderHeightChange,
    parentId,
    screenId,
    stackPresentation,
    style,
    ...rest
  },
  ref
) {
  const stackContext = React.useContext(NativeScriptScreenStackContext);
  const resolvedParentId = parentId ?? stackContext?.stackId;
  const active = rest.activityState !== 0;
  const registeredPropsRef =
    React.useRef<NativeScriptScreenStackItemProps | null>(null);
  const [contentRevision, bumpContentRevision] = React.useReducer(
    (value: number) => value + 1,
    0
  );
  const lastLayoutSignatureRef = React.useRef<string | null>(null);
  const onLayoutProp = rest.onLayout;

  registeredPropsRef.current = {
    ...rest,
    contentStyle,
    headerConfig,
    nativeScriptContentRevision: contentRevision,
    onHeaderHeightChange,
    parentId: resolvedParentId,
    screenId,
    stackPresentation,
    style,
  } as NativeScriptScreenStackItemProps;

  const handleContentLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      onLayoutProp?.(event);

      const { height, width, x, y } = event.nativeEvent.layout;
      const layoutSignature = `${x}:${y}:${width}:${height}`;

      if (lastLayoutSignatureRef.current === layoutSignature) {
        return;
      }

      lastLayoutSignatureRef.current = layoutSignature;
      bumpContentRevision();
    },
    [onLayoutProp]
  );

  const content = (
    <View
      ref={ref}
      accessibilityElementsHidden={rest['aria-hidden'] === true}
      aria-hidden={rest['aria-hidden']}
      pointerEvents={rest.pointerEvents}
      importantForAccessibility={
        rest['aria-hidden'] === true ? 'no-hide-descendants' : 'auto'
      }
      onLayout={handleContentLayout}
      style={[styles.content, contentStyle]}
    >
      {children}
    </View>
  );

  React.useLayoutEffect(() => {
    if (!stackContext) {
      return;
    }

    return () => {
      stackContext.unregisterScreen(screenId);
    };
  }, [screenId, stackContext]);

  React.useLayoutEffect(() => {
    if (!stackContext) {
      return;
    }

    stackContext.registerScreen(screenId, registeredPropsRef.current!, active);
  });

  React.useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const invalidateContent = () => {
      if (!cancelled) {
        bumpContentRevision();
      }
    };

    invalidateContent();

    timers.push(setTimeout(invalidateContent, 16));
    timers.push(setTimeout(invalidateContent, 64));
    timers.push(setTimeout(invalidateContent, 160));
    timers.push(setTimeout(invalidateContent, 320));
    timers.push(setTimeout(invalidateContent, 640));

    return () => {
      cancelled = true;

      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [active, screenId]);

  return (
    <NativeScriptScreenController
      {...rest}
      attachController
      attachControllerView={false}
      attachNativeView={false}
      contentStyle={contentStyle}
      headerConfig={headerConfig}
      nativeScriptContentRevision={contentRevision}
      onHeaderHeightChange={onHeaderHeightChange}
      parentId={resolvedParentId}
      screenId={screenId}
      stackPresentation={stackPresentation}
      style={[styles.screen, style]}
    >
      {content}
    </NativeScriptScreenController>
  );
});

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
});
