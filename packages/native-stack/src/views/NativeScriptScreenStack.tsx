import * as NativeScriptRuntime from '@nativescript/react-native';
import * as React from 'react';
import {
  Platform,
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
  stackTransitionScreenIds: Record<string, string | undefined>;
  stackTransitionTokens: Record<string, number | undefined>;
  screenHeaderConfigs: Record<string, ScreenStackHeaderConfigProps | undefined>;
  screenContexts: Record<string, any>;
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
    stackTransitionScreenIds: {},
    stackTransitionTokens: {},
    screenHeaderConfigs: {},
    screenContexts: {},
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

function touchUpInsideControlEvent() {
  'worklet';
  const events = nativeValue('UIControlEvents');

  return (
    events?.TouchUpInside ??
    events?.touchUpInside ??
    nativeValue('UIControlEventTouchUpInside') ??
    64
  );
}

function systemButtonType() {
  'worklet';
  const type = nativeValue('UIButtonType');

  return type?.System ?? type?.system ?? 1;
}

function normalControlState() {
  'worklet';
  const state = nativeValue('UIControlState');

  return (
    state?.Normal ?? state?.normal ?? nativeValue('UIControlStateNormal') ?? 0
  );
}

function leftContentAlignment() {
  'worklet';
  const alignment = nativeValue('UIControlContentHorizontalAlignment');

  return alignment?.Left ?? alignment?.left ?? 1;
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

  if (typeof value.objectAtIndex === 'function') {
    return value.objectAtIndex(index);
  }

  return value[index] ?? null;
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

function layoutHostedReactSubviews(controller: any) {
  'worklet';
  const rootView = controller?.view;

  if (!rootView) {
    return;
  }

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
  ctx: any,
  isTopScreen: boolean
) {
  'worklet';
  const navigationController = controller?.navigationController;
  const navigationItem = controller?.navigationItem;

  if (!navigationController || !navigationItem) {
    return;
  }

  const viewControllers = navigationController.viewControllers;
  const count = arrayCount(viewControllers);
  const existingItem = navigationItem.leftBarButtonItem;
  const existingButton = existingItem?.customView;
  const hasNativeScriptBackButton = existingButton?.tag === BACK_BUTTON_TAG;
  const shouldShowBackButton =
    count > 1 &&
    isTopScreen &&
    props.headerConfig?.hideBackButton !== true &&
    typeof props.onHeaderBackButtonClicked === 'function';

  if (!shouldShowBackButton) {
    if (hasNativeScriptBackButton) {
      navigationItem.leftBarButtonItem = null;
    }
    navigationItem.hidesBackButton =
      props.headerConfig?.hideBackButton === true;
    return;
  }

  navigationItem.hidesBackButton = true;

  if (hasNativeScriptBackButton) {
    return;
  }

  const UIButton = nativeValue('UIButton');
  const UIBarButtonItem = nativeValue('UIBarButtonItem');

  if (
    !ctx ||
    !UIButton ||
    typeof UIButton.buttonWithType !== 'function' ||
    !UIBarButtonItem ||
    typeof UIBarButtonItem.alloc !== 'function'
  ) {
    return;
  }

  const button = UIButton.buttonWithType(systemButtonType());

  button.tag = BACK_BUTTON_TAG;
  button.accessibilityLabel = 'Back';
  button.contentHorizontalAlignment = leftContentAlignment();

  const CGRectMake = nativeValue('CGRectMake');
  button.frame =
    typeof CGRectMake === 'function'
      ? CGRectMake(0, 0, 44, 44)
      : { origin: { x: 0, y: 0 }, size: { width: 44, height: 44 } };

  const UIImage = nativeValue('UIImage');
  const chevron =
    UIImage && typeof UIImage.systemImageNamed === 'function'
      ? UIImage.systemImageNamed('chevron.backward')
      : null;

  if (chevron && typeof button.setImageForState === 'function') {
    button.setImageForState(chevron, normalControlState());
  } else if (typeof button.setTitleForState === 'function') {
    button.setTitleForState('‹', normalControlState());
  }

  ctx.targetAction(button, touchUpInsideControlEvent(), () => {
    'worklet';
    ctx.emit('onHeaderBackButtonClicked', {
      nativeEvent: {},
    });
  });

  const allocatedItem = UIBarButtonItem.alloc();
  const item =
    allocatedItem && typeof allocatedItem.initWithCustomView === 'function'
      ? allocatedItem.initWithCustomView(button)
      : allocatedItem;

  if (item) {
    item.style = plainBarButtonStyle();
    navigationItem.leftBarButtonItem = item;
  }
}

function screenIdForController(
  controller: any,
  registry: NativeScriptStackRegistry
) {
  'worklet';

  for (const screenId in registry.screens) {
    if (registry.screens[screenId] === controller) {
      return screenId;
    }
  }

  return undefined;
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

  ctx.delegate(gesture, delegateProtocol, {
    gestureRecognizerShouldBegin() {
      'worklet';

      return arrayCount(navigationController.viewControllers) > 1;
    },
    gestureRecognizerShouldRecognizeSimultaneouslyWithGestureRecognizer() {
      'worklet';

      return true;
    },
  });

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

    if (navigationItem) {
      navigationItem.backButtonDisplayMode = backButtonDisplayMode(
        headerConfig?.backTitleVisible === false
          ? 'minimal'
          : headerConfig?.backButtonDisplayMode
      );

      if (
        headerConfig?.backTitle != null ||
        headerConfig?.backTitleVisible === false
      ) {
        const UIBarButtonItem = nativeValue('UIBarButtonItem');
        const style =
          nativeValue('UIBarButtonItemStyle')?.Plain ??
          nativeValue('UIBarButtonItemStyle')?.plain ??
          0;

        if (UIBarButtonItem && typeof UIBarButtonItem.alloc === 'function') {
          const itemAllocated = UIBarButtonItem.alloc();
          const title =
            headerConfig.backTitleVisible === false
              ? ''
              : headerConfig.backTitle;

          navigationItem.backBarButtonItem =
            itemAllocated &&
            typeof itemAllocated.initWithTitleStyleTargetAction === 'function'
              ? itemAllocated.initWithTitleStyleTargetAction(
                  title,
                  style,
                  null,
                  null
                )
              : itemAllocated;
        }
      }
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
  isTopScreen = false
) {
  'worklet';

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

  configureHeaderBackButton(controller, props, ctx, isTopScreen);
}

function configureStackControllers(
  ids: string[],
  registry: NativeScriptStackRegistry
) {
  'worklet';

  for (const id of ids) {
    const controller = registry.screens[id];
    const props = registry.screenProps[id];

    if (!controller || !props) {
      continue;
    }

    configureScreenController(
      controller,
      props,
      registry.screenContexts[id],
      id === ids[ids.length - 1]
    );
  }
}

function emitStackChange(ctx: any, navigationController: any) {
  'worklet';

  if (!ctx) {
    return;
  }

  const registry = getRegistry(globalThis as Record<string, any>);
  const screenIds = navigationControllerScreenIds(
    navigationController,
    registry
  );

  ctx.emit('onNativeStackChange', {
    nativeEvent: {
      screenIds,
    },
  });
}

function scheduleStackChange(ctx: any, navigationController: any) {
  'worklet';

  emitStackChange(ctx, navigationController);

  if (typeof setTimeout !== 'function') {
    return;
  }

  const emit = () => {
    'worklet';
    emitStackChange(ctx, navigationController);
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

function markTransition(
  stackId: string,
  registry: NativeScriptStackRegistry,
  ctx: any,
  closing: boolean,
  screenId: string | undefined
) {
  'worklet';
  const token = (registry.stackTransitionTokens[stackId] ?? 0) + 1;

  registry.stackTransitionTokens[stackId] = token;
  registry.stackTransitioning[stackId] = true;
  registry.stackTransitionClosing[stackId] = closing;
  registry.stackTransitionScreenIds[stackId] = screenId;
  emitTransition(ctx, 'start', closing, screenId);
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
  targetController: any,
  nextCount: number,
  previousCount: number
) {
  'worklet';

  if (!parent) {
    return false;
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
    nextCount === previousCount - 1 &&
    typeof parent.popViewControllerAnimated === 'function'
  ) {
    parent.popViewControllerAnimated(true);

    return true;
  }

  if (
    targetController &&
    typeof parent.popToViewControllerAnimated === 'function'
  ) {
    parent.popToViewControllerAnimated(targetController, true);

    return true;
  }

  return false;
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

  const previousKey = registry.stackNativeKeys[stackId];
  const previousIds = idsFromKey(previousKey);
  const previousCount = registry.stackNativeCounts[stackId] ?? 0;
  const nextKey = idsKey(availableIds);
  const didChange = previousKey !== nextKey;
  const nativeIds = navigationControllerScreenIds(
    navigationController,
    registry
  );

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

      markTransition(stackId, registry, ctx, false, pushedScreenId);

      if (animateStackPush(navigationController, controllers[nextCount - 1])) {
        layoutNavigationStackViews(navigationController);
        configureStackControllers(availableIds, registry);
        configureNavigationAppearance(
          navigationController,
          registry.screenHeaderConfigs[availableIds[nextCount - 1]]
        );
        updateNativeBackGesture(navigationController);

        return;
      }

      registry.stackTransitioning[stackId] = false;
      registry.stackTransitionClosing[stackId] = undefined;
      registry.stackTransitionScreenIds[stackId] = undefined;
    }

    if (isPop && nativeIds.length > nextCount) {
      const poppedScreenId = previousIds[nextCount];

      markTransition(stackId, registry, ctx, true, poppedScreenId);

      if (
        animateStackPop(
          navigationController,
          controllers[nextCount - 1],
          nextCount,
          previousCount
        )
      ) {
        layoutNavigationStackViews(navigationController);
        configureStackControllers(availableIds, registry);
        configureNavigationAppearance(
          navigationController,
          registry.screenHeaderConfigs[availableIds[nextCount - 1]]
        );
        updateNativeBackGesture(navigationController);

        return;
      }

      registry.stackTransitioning[stackId] = false;
      registry.stackTransitionClosing[stackId] = undefined;
      registry.stackTransitionScreenIds[stackId] = undefined;
    }
  }

  if (typeof navigationController.setViewControllersAnimated === 'function') {
    navigationController.setViewControllersAnimated(
      createArray(controllers),
      false
    );
  } else {
    navigationController.viewControllers = createArray(controllers);
  }

  layoutNavigationStackViews(navigationController);
  configureStackControllers(availableIds, registry);
  configureNavigationAppearance(
    navigationController,
    registry.screenHeaderConfigs[availableIds[nextCount - 1]]
  );
  updateNativeBackGesture(navigationController);
}

const NativeScriptStackController = NativeScriptRuntime.defineUIViewController<
  {
    activeScreenIds: string[];
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

        layoutNavigationStackViews(navigationController);
        configureStackControllers(
          navigationControllerScreenIds(navigationController, registry),
          registry
        );

        if (registry.stackTransitioning[ctx.props.stackId]) {
          return;
        }

        registry.stackTransitioning[ctx.props.stackId] = true;
        registry.stackTransitionClosing[ctx.props.stackId] = closing;
        registry.stackTransitionScreenIds[ctx.props.stackId] = affectedScreenId;
        emitTransition(ctx, 'start', closing, affectedScreenId);
      },
      navigationControllerDidShowViewControllerAnimated(
        navigationController: any,
        viewController: any
      ) {
        'worklet';
        const registry = getRegistry(globalThis as Record<string, any>);
        const screenId = screenIdForController(viewController, registry);

        if (!screenId) {
          layoutNavigationStackViews(navigationController);
          updateNativeBackGesture(navigationController);
          return;
        }

        layoutNavigationStackViews(navigationController);
        configureStackControllers(
          navigationControllerScreenIds(navigationController, registry),
          registry
        );
        updateNativeBackGesture(navigationController);
        configureNavigationAppearance(
          navigationController,
          registry.screenHeaderConfigs[screenId]
        );
        scheduleStackChange(ctx, navigationController);
        const wasClosing =
          registry.stackTransitionClosing[ctx.props.stackId] === true;

        emitTransition(
          ctx,
          'end',
          wasClosing,
          registry.stackTransitionScreenIds[ctx.props.stackId] ?? screenId
        );
        registry.stackTransitioning[ctx.props.stackId] = false;
        registry.stackTransitionClosing[ctx.props.stackId] = undefined;
        registry.stackTransitionScreenIds[ctx.props.stackId] = undefined;
        registry.stackTransitionTokens[ctx.props.stackId] =
          (registry.stackTransitionTokens[ctx.props.stackId] ?? 0) + 1;

        if (!wasClosing) {
          reconcileStack(ctx.props.stackId, registry, ctx, true);
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
    registry.stackTransitionScreenIds[props.stackId] = undefined;
    registry.stackTransitionTokens[props.stackId] = undefined;
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
  dispose(_controller, props) {
    'worklet';
    const registry = (globalThis as Record<string, any>)[REGISTRY_KEY];

    if (!registry) {
      return;
    }

    registry.screens[props.screenId] = undefined;
    registry.screenHeaderConfigs[props.screenId] = undefined;
    registry.screenContexts[props.screenId] = undefined;
    registry.screenParents[props.screenId] = undefined;
    registry.screenProps[props.screenId] = undefined;

    if (props.parentId) {
      reconcileStack(
        props.parentId,
        registry,
        registry.stackContexts[props.parentId],
        false
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
  const [, forceVersion] = React.useReducer((value: number) => value + 1, 0);

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
        existing.props.headerConfig !== props.headerConfig;

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

  registeredPropsRef.current = {
    ...rest,
    contentStyle,
    headerConfig,
    onHeaderHeightChange,
    parentId: resolvedParentId,
    screenId,
    stackPresentation,
    style,
  } as NativeScriptScreenStackItemProps;

  const content = (
    <View
      ref={ref}
      accessibilityElementsHidden={rest['aria-hidden'] === true}
      aria-hidden={rest['aria-hidden']}
      importantForAccessibility={
        rest['aria-hidden'] === true ? 'no-hide-descendants' : 'auto'
      }
      style={[styles.content, contentStyle]}
    >
      {children}
    </View>
  );

  React.useEffect(() => {
    if (headerConfig?.hidden === true) {
      return;
    }

    if (typeof onHeaderHeightChange === 'function') {
      onHeaderHeightChange({
        nativeEvent: {
          headerHeight:
            Platform.OS === 'ios' && stackPresentation !== 'push' ? 56 : 44,
        },
      } as Parameters<NonNullable<ScreenProps['onHeaderHeightChange']>>[0]);
    }
  }, [headerConfig?.hidden, onHeaderHeightChange, stackPresentation]);

  React.useLayoutEffect(() => {
    if (!stackContext) {
      return;
    }

    stackContext.registerScreen(screenId, registeredPropsRef.current!, active);

    return () => {
      stackContext.unregisterScreen(screenId);
    };
  }, [active, headerConfig, resolvedParentId, screenId, stackContext]);

  return (
    <NativeScriptScreenController
      {...rest}
      attachController
      attachControllerView={false}
      attachNativeView={false}
      contentStyle={contentStyle}
      headerConfig={headerConfig}
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
