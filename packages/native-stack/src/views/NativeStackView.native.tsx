import {
  getDefaultHeaderHeight,
  getHeaderTitle,
  HeaderBackContext,
  HeaderHeightContext,
  HeaderShownContext,
  useFrameSize,
} from '@react-navigation/elements';
import {
  ActivityView,
  SafeAreaProviderCompat,
} from '@react-navigation/elements/internal';
import {
  NavigationProvider,
  type ParamListBase,
  StackActions,
  type StackNavigationState,
  usePreventRemoveContext,
  useTheme,
} from '@react-navigation/native';
import * as React from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  useAnimatedValue,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ScreenProps } from 'react-native-screens';

import type {
  NativeStackDescriptor,
  NativeStackDescriptorMap,
  NativeStackNavigationHelpers,
} from '../types';
import { debounce } from '../utils/debounce';
import { getModalRouteKeys } from '../utils/getModalRoutesKeys';
import { AnimatedHeaderHeightContext } from '../utils/useAnimatedHeaderHeight';
import { useDismissedRouteError } from '../utils/useDismissedRouteError';
import { useInvalidPreventRemoveError } from '../utils/useInvalidPreventRemoveError';
import {
  NativeScriptScreenStack as ScreenStack,
  NativeScriptScreenStackItem as ScreenStackItem,
  repairNativeScriptStackAfterDismiss,
  requestNativeScriptStackPop,
} from './NativeScriptScreenStack';
import { useHeaderConfigProps } from './useHeaderConfigProps';

const ANDROID_DEFAULT_HEADER_HEIGHT = 56;

type SceneViewProps = {
  index: number;
  focused: boolean;
  descriptor: NativeStackDescriptor;
  previousDescriptor?: NativeStackDescriptor | undefined;
  nextDescriptor?: NativeStackDescriptor | undefined;
  isPresentationModal: boolean;
  isNextScreenTransparent: boolean;
  isInactive: boolean;
  isBeforeLast: boolean;
  onWillDisappear: () => void;
  onWillAppear: () => void;
  onAppear: () => void;
  onDisappear: () => void;
  onDismissed: ScreenProps['onDismissed'];
  onHeaderBackButtonClicked: ScreenProps['onHeaderBackButtonClicked'];
  onNativeDismissCancelled: ScreenProps['onDismissed'];
  onGestureCancel: ScreenProps['onGestureCancel'];
  onSheetDetentChanged: ScreenProps['onSheetDetentChanged'];
};

const useNativeDriver = Platform.OS !== 'web';

const TRANSPARENT_PRESENTATIONS = [
  'transparentModal',
  'containedTransparentModal',
];

const ORIGINAL_DISPATCH_KEY = '__nativeScriptOriginalDispatch';

function nativePopCountForAction(action: any): number | null {
  if (!action || typeof action.type !== 'string') {
    return null;
  }

  if (action.type === 'GO_BACK') {
    return 1;
  }

  if (action.type === 'POP') {
    return Math.max(1, action.payload?.count ?? 1);
  }

  if (action.type === 'POP_TO_TOP') {
    return Number.MAX_SAFE_INTEGER;
  }

  return null;
}

function dispatchWithOriginalNavigation(
  navigation: NativeStackNavigationHelpers,
  action: unknown
) {
  const navigationAny = navigation as any;
  const originalDispatch = navigationAny[ORIGINAL_DISPATCH_KEY];

  if (typeof originalDispatch === 'function') {
    originalDispatch(action);
  } else {
    navigation.dispatch(action as never);
  }
}

const SceneView = ({
  index,
  focused,
  descriptor,
  previousDescriptor,
  isPresentationModal,
  isNextScreenTransparent,
  isInactive,
  isBeforeLast,
  onWillDisappear,
  onWillAppear,
  onAppear,
  onDisappear,
  onDismissed,
  onHeaderBackButtonClicked,
  onNativeDismissCancelled,
  onGestureCancel,
  onSheetDetentChanged,
}: SceneViewProps) => {
  const { route, navigation, options, render } = descriptor;

  React.useLayoutEffect(() => {
    if (Platform.OS !== 'ios' || index <= 0) {
      return;
    }

    const navigationAny = navigation as any;
    const originalDispatch =
      navigationAny[ORIGINAL_DISPATCH_KEY] ??
      navigationAny.dispatch?.bind(navigation);
    const originalGoBack = navigationAny.goBack;
    const originalPop = navigationAny.pop;
    const originalPopToTop = navigationAny.popToTop;

    if (typeof originalDispatch !== 'function') {
      return;
    }

    navigationAny[ORIGINAL_DISPATCH_KEY] = originalDispatch;

    const requestPop = (count = 1, attempt = 0) => {
      void requestNativeScriptStackPop(route.key, count)
        .then((result: string) => {
          if (result === 'transitioning' && attempt < 8) {
            setTimeout(() => requestPop(count, attempt + 1), 80);
            return undefined;
          }

          if (result === 'ok-modal') {
            originalDispatch({
              ...StackActions.pop(count),
              source: route.key,
            });
          }

          return undefined;
        })
        .catch(() => undefined);
    };
    const patchedGoBack = () => {
      requestPop(1);
    };
    const patchedPop = (count = 1) => {
      requestPop(count);
    };
    const patchedPopToTop = () => {
      requestPop(Number.MAX_SAFE_INTEGER);
    };
    const patchedDispatch = (actionOrThunk: any) => {
      const action =
        typeof actionOrThunk === 'function'
          ? actionOrThunk(navigationAny.getState?.())
          : actionOrThunk;
      const nativePopCount = nativePopCountForAction(action);

      if (nativePopCount != null) {
        requestPop(nativePopCount);
        return;
      }

      originalDispatch(action);
    };

    navigationAny.goBack = patchedGoBack;

    if (typeof originalPop === 'function') {
      navigationAny.pop = patchedPop;
    }

    if (typeof originalPopToTop === 'function') {
      navigationAny.popToTop = patchedPopToTop;
    }

    navigationAny.dispatch = patchedDispatch;

    return () => {
      if (navigationAny.goBack === patchedGoBack) {
        navigationAny.goBack = originalGoBack;
      }

      if (navigationAny.pop === patchedPop) {
        navigationAny.pop = originalPop;
      }

      if (navigationAny.popToTop === patchedPopToTop) {
        navigationAny.popToTop = originalPopToTop;
      }

      if (navigationAny.dispatch === patchedDispatch) {
        navigationAny.dispatch = originalDispatch;
      }
    };
  }, [index, navigation, route.key]);

  const {
    inactiveBehavior = 'pause',
    animation,
    animationDuration,
    animationMatchesGesture,
    animationTypeForReplace = 'push',
    fullScreenGestureEnabled,
    fullScreenGestureShadowEnabled = true,
    gestureEnabled,
    gestureDirection,
    gestureResponseDistance,
    header,
    headerBackButtonMenuEnabled,
    headerShown,
    headerBackground,
    headerTransparent,
    autoHideHomeIndicator,
    keyboardHandlingEnabled,
    navigationBarHidden,
    orientation,
    sheetAllowedDetents = [1.0],
    sheetLargestUndimmedDetentIndex = -1,
    sheetGrabberVisible = false,
    sheetCornerRadius = -1.0,
    sheetElevation = 24,
    sheetExpandsWhenScrolledToEdge = true,
    sheetInitialDetentIndex = 0,
    sheetShouldOverflowTopInset = false,
    sheetResizeAnimationEnabled = true,
    statusBarAnimation,
    statusBarHidden,
    statusBarStyle,
    unstable_sheetFooter,
    scrollEdgeEffects,
    contentStyle,
  } = options;

  let { presentation = isPresentationModal ? 'modal' : 'card' } = options;

  if (index === 0) {
    // first screen should always be treated as `card`, it resolves problems with no header animation
    // for navigator with first screen as `modal` and the next as `card`
    presentation = 'card';
  }

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // `modal`, `formSheet` and `pageSheet` presentations do not take whole screen, so should not take the inset.
  const isModal =
    presentation === 'modal' ||
    presentation === 'formSheet' ||
    presentation === 'pageSheet';

  // Modals are fullscreen in landscape only on iPhone
  const isIPhone = Platform.OS === 'ios' && !(Platform.isPad || Platform.isTV);

  const isParentHeaderShown = React.use(HeaderShownContext);
  const parentHeaderHeight = React.use(HeaderHeightContext);
  const parentHeaderBack = React.use(HeaderBackContext);

  const isLandscape = useFrameSize((frame) => frame.width > frame.height);

  const topInset =
    isParentHeaderShown ||
    (Platform.OS === 'ios' && isModal) ||
    (isIPhone && isLandscape)
      ? 0
      : insets.top;

  const defaultHeaderHeight = useFrameSize((frame) =>
    Platform.select({
      // FIXME: Currently screens isn't using Material 3
      // So our `getDefaultHeaderHeight` doesn't return the correct value
      // So we hardcode the value here for now until screens is updated
      android: ANDROID_DEFAULT_HEADER_HEIGHT + topInset,
      default: getDefaultHeaderHeight({
        landscape: frame.width > frame.height,
        modalPresentation: isModal,
        topInset,
      }),
    })
  );

  const { preventedRoutes } = usePreventRemoveContext();

  const [headerHeight, setHeaderHeight] = React.useState(defaultHeaderHeight);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setHeaderHeightDebounced = React.useCallback(
    // Debounce the header height updates to avoid excessive re-renders
    debounce(setHeaderHeight, 100),
    []
  );

  const hasCustomHeader = header != null;

  const headerTopInsetEnabled = topInset !== 0;

  const canGoBack = previousDescriptor != null || parentHeaderBack != null;
  const backTitle = previousDescriptor
    ? getHeaderTitle(previousDescriptor.options, previousDescriptor.route.name)
    : parentHeaderBack?.title;

  const headerBack = React.useMemo(() => {
    if (canGoBack) {
      return {
        href: undefined, // No href needed for native
        title: backTitle,
      };
    }

    return undefined;
  }, [canGoBack, backTitle]);

  const isRemovePrevented = preventedRoutes[route.key]?.preventRemove;

  const animatedHeaderHeight = useAnimatedValue(defaultHeaderHeight);

  const headerConfig = useHeaderConfigProps({
    ...options,
    route,
    headerBackButtonMenuEnabled:
      isRemovePrevented !== undefined
        ? !isRemovePrevented
        : headerBackButtonMenuEnabled,
    headerBackTitle:
      options.headerBackTitle !== undefined
        ? options.headerBackTitle
        : undefined,
    headerHeight,
    headerShown: header !== undefined ? false : headerShown,
    headerTopInsetEnabled,
    headerBack,
  });

  const headerContainerRef = React.useRef<View>(null);

  React.useLayoutEffect(() => {
    headerContainerRef.current?.measure((_x, _y, _width, height) => {
      animatedHeaderHeight.setValue(height);
      setHeaderHeight(height);
    });
  }, [animatedHeaderHeight]);

  const onHeaderHeightChange = hasCustomHeader
    ? // If we have a custom header, don't use native header height
      undefined
    : // On Fabric, there's a bug where native event drivers for Animated objects
      // are created after the first notifications about the header height
      // from the native side, `onHeaderHeightChange` event does not notify
      // `animatedHeaderHeight` about initial values on appearing screens at the moment.
      Animated.event(
        [
          {
            nativeEvent: {
              headerHeight: animatedHeaderHeight,
            },
          },
        ],
        {
          useNativeDriver,
          listener: (e) => {
            if (
              e.nativeEvent &&
              typeof e.nativeEvent === 'object' &&
              'headerHeight' in e.nativeEvent &&
              typeof e.nativeEvent.headerHeight === 'number'
            ) {
              const headerHeight = e.nativeEvent.headerHeight;

              // Only debounce if header has large title or search bar
              // As it's the only case where the header height can change frequently
              const doesHeaderAnimate =
                Platform.OS === 'ios' &&
                (options.headerLargeTitleEnabled ||
                  options.headerSearchBarOptions);

              if (doesHeaderAnimate) {
                setHeaderHeightDebounced(headerHeight);
              } else {
                if (
                  Platform.OS === 'android' &&
                  headerHeight !== 0 &&
                  // On some devices, height maybe slightly off (e.g. 56.17 instead of 56)
                  Math.round(headerHeight) <= ANDROID_DEFAULT_HEADER_HEIGHT
                ) {
                  // FIXME: On Android, events may get delivered out-of-order
                  // https://github.com/facebook/react-native/issues/54636
                  // We seem to get header height without status bar height first,
                  // and then the correct height with status bar height included
                  // But due to out-of-order delivery, we may get the correct height first
                  // and then the one without status bar height
                  // This is hack to include status bar height if it's not already included
                  // It only works because header height doesn't change dynamically on Android
                  setHeaderHeight(headerHeight + insets.top);
                } else {
                  setHeaderHeight(headerHeight);
                }
              }
            }
          },
        }
      );

  const activityMode =
    // Render focused screens normally
    // Unpause preloaded and retained screens so updates are visible
    // This lets effects on those screens run
    // We don't need to handle inert as it'll be handled natively
    inactiveBehavior === 'none' ||
    focused ||
    isInactive ||
    isNextScreenTransparent
      ? 'normal'
      : inactiveBehavior === 'unmount' &&
          !isBeforeLast &&
          !('state' in route && route.state)
        ? 'unmounted'
        : 'paused';

  const content = (
    <AnimatedHeaderHeightContext.Provider value={animatedHeaderHeight}>
      <HeaderHeightContext.Provider
        value={headerShown !== false ? headerHeight : (parentHeaderHeight ?? 0)}
      >
        {headerBackground != null ? (
          /**
           * To show a custom header background, we render it at the top of the screen below the header
           * The header also needs to be positioned absolutely (with `translucent` style)
           */
          <View
            style={[
              styles.background,
              headerTransparent ? styles.translucent : null,
              { height: headerHeight },
            ]}
          >
            {headerBackground()}
          </View>
        ) : null}
        {header != null && headerShown !== false ? (
          <View
            style={[
              styles.header,
              headerTransparent
                ? [
                    styles.absolute,
                    // Specify an explicit min height for Android screen readers
                    { minHeight: headerHeight },
                  ]
                : null,
            ]}
          >
            <View
              ref={headerContainerRef}
              onLayout={(e) => {
                const headerHeight = e.nativeEvent.layout.height;

                animatedHeaderHeight.setValue(headerHeight);
                setHeaderHeight(headerHeight);
              }}
              style={{ pointerEvents: 'box-none' }}
            >
              {header({
                back: headerBack,
                options,
                route,
                navigation,
              })}
            </View>
          </View>
        ) : null}
        <HeaderShownContext.Provider
          value={isParentHeaderShown || headerShown !== false}
        >
          <HeaderBackContext.Provider value={headerBack}>
            {render()}
          </HeaderBackContext.Provider>
        </HeaderShownContext.Provider>
      </HeaderHeightContext.Provider>
    </AnimatedHeaderHeightContext.Provider>
  );
  return (
    <NavigationProvider navigation={navigation} route={route}>
      <ScreenStackItem
        key={route.key}
        screenId={route.key}
        activityState={isInactive ? 0 : 2}
        style={StyleSheet.absoluteFill}
        pointerEvents={isInactive ? 'none' : 'auto'}
        aria-hidden={!focused}
        customAnimationOnSwipe={animationMatchesGesture}
        fullScreenSwipeEnabled={fullScreenGestureEnabled}
        fullScreenSwipeShadowEnabled={fullScreenGestureShadowEnabled}
        gestureEnabled={
          Platform.OS === 'android'
            ? // This prop enables handling of system back gestures on Android
              // Since we handle them in JS side, we disable this
              false
            : gestureEnabled
        }
        homeIndicatorHidden={autoHideHomeIndicator}
        hideKeyboardOnSwipe={keyboardHandlingEnabled}
        navigationBarHidden={navigationBarHidden}
        replaceAnimation={animationTypeForReplace}
        stackPresentation={presentation === 'card' ? 'push' : presentation}
        stackAnimation={animation}
        screenOrientation={orientation}
        sheetAllowedDetents={sheetAllowedDetents}
        sheetLargestUndimmedDetentIndex={sheetLargestUndimmedDetentIndex}
        sheetGrabberVisible={sheetGrabberVisible}
        sheetInitialDetentIndex={sheetInitialDetentIndex}
        sheetCornerRadius={sheetCornerRadius}
        sheetElevation={sheetElevation}
        sheetExpandsWhenScrolledToEdge={sheetExpandsWhenScrolledToEdge}
        sheetShouldOverflowTopInset={sheetShouldOverflowTopInset}
        sheetDefaultResizeAnimationEnabled={sheetResizeAnimationEnabled}
        statusBarAnimation={statusBarAnimation}
        statusBarHidden={statusBarHidden}
        statusBarStyle={statusBarStyle}
        swipeDirection={gestureDirection}
        transitionDuration={animationDuration}
        onWillAppear={onWillAppear}
        onWillDisappear={onWillDisappear}
        onAppear={onAppear}
        onDisappear={onDisappear}
        onDismissed={onDismissed}
        onGestureCancel={onGestureCancel}
        onSheetDetentChanged={onSheetDetentChanged}
        gestureResponseDistance={gestureResponseDistance}
        nativeBackButtonDismissalEnabled={false} // on Android
        onHeaderBackButtonClicked={onHeaderBackButtonClicked}
        preventNativeDismiss={isRemovePrevented} // on iOS
        scrollEdgeEffects={{
          bottom: scrollEdgeEffects?.bottom ?? 'automatic',
          top: scrollEdgeEffects?.top ?? 'automatic',
          left: scrollEdgeEffects?.left ?? 'automatic',
          right: scrollEdgeEffects?.right ?? 'automatic',
        }}
        onNativeDismissCancelled={onNativeDismissCancelled}
        onHeaderHeightChange={onHeaderHeightChange}
        contentStyle={[
          presentation !== 'transparentModal' &&
            presentation !== 'containedTransparentModal' && {
              backgroundColor: colors.background,
            },
          contentStyle,
        ]}
        headerConfig={headerConfig}
        unstable_sheetFooter={unstable_sheetFooter}
      >
        {activityMode === 'unmounted' ? null : (
          <ActivityView mode={activityMode} visible style={styles.content}>
            {content}
          </ActivityView>
        )}
      </ScreenStackItem>
    </NavigationProvider>
  );
};

type Props = {
  state: StackNavigationState<ParamListBase>;
  navigation: NativeStackNavigationHelpers;
  descriptors: NativeStackDescriptorMap;
};

type RouteRecord = {
  descriptor: NativeStackDescriptor;
  index: number;
  route: StackNavigationState<ParamListBase>['routes'][number];
};

function includesRouteKey(records: RouteRecord[], key: string) {
  return records.some((record) => record.route.key === key);
}

export function NativeStackView({ state, navigation, descriptors }: Props) {
  const { setNextDismissedKey } = useDismissedRouteError(state);
  const [, forceRetainedRoutesUpdate] = React.useReducer(
    (value: number) => value + 1,
    0
  );
  const previousRouteRecordsRef = React.useRef<RouteRecord[]>([]);
  const retainedRouteRecordsRef = React.useRef<RouteRecord[]>([]);
  const closingTransitionRouteKeysRef = React.useRef<Set<string>>(new Set());
  const completedClosingRouteKeysRef = React.useRef<Set<string>>(new Set());

  useInvalidPreventRemoveError(descriptors);

  const activeRoutes = state.routes.slice(0, state.index + 1);
  const modalRouteKeys = getModalRouteKeys(activeRoutes, descriptors);
  const currentRouteRecords = state.routes
    .map((route, index) => {
      const descriptor = descriptors[route.key];

      return descriptor ? { descriptor, index, route } : null;
    })
    .filter((record): record is RouteRecord => record != null);
  const previousRouteRecords = previousRouteRecordsRef.current;
  const removedRouteRecords = previousRouteRecords.filter(
    (record) => !includesRouteKey(currentRouteRecords, record.route.key)
  );

  if (removedRouteRecords.length > 0) {
    const retainedRouteRecords = retainedRouteRecordsRef.current.filter(
      (record) => !includesRouteKey(currentRouteRecords, record.route.key)
    );

    for (const record of removedRouteRecords) {
      if (completedClosingRouteKeysRef.current.has(record.route.key)) {
        completedClosingRouteKeysRef.current.delete(record.route.key);
        continue;
      }

      if (!includesRouteKey(retainedRouteRecords, record.route.key)) {
        retainedRouteRecords.push(record);
      }
    }

    retainedRouteRecordsRef.current = retainedRouteRecords;
  }

  previousRouteRecordsRef.current = currentRouteRecords;

  const retainedRouteRecords = retainedRouteRecordsRef.current.filter(
    (record) => !includesRouteKey(currentRouteRecords, record.route.key)
  );
  const topRouteKey = activeRoutes[activeRoutes.length - 1]?.key;
  const isTopRouteModal =
    topRouteKey != null && modalRouteKeys.includes(topRouteKey);
  const renderRouteRecords = [...currentRouteRecords, ...retainedRouteRecords]
    .filter((record, index, records) => {
      return (
        records.findIndex((item) => item.route.key === record.route.key) ===
        index
      );
    })
    .sort((left, right) => left.index - right.index);

  if (retainedRouteRecords.length !== retainedRouteRecordsRef.current.length) {
    retainedRouteRecordsRef.current = retainedRouteRecords;
  }

  const clearRetainedRoute = React.useCallback((routeKey: string) => {
    const nextRecords = retainedRouteRecordsRef.current.filter(
      (record) => record.route.key !== routeKey
    );

    if (nextRecords.length !== retainedRouteRecordsRef.current.length) {
      retainedRouteRecordsRef.current = nextRecords;
      forceRetainedRoutesUpdate();
    }
  }, []);

  const handleNativeStackTransition = React.useCallback(
    (event: {
      nativeEvent: {
        closing: boolean;
        phase: 'start' | 'end';
        screenId: string;
      };
    }) => {
      const { closing, phase, screenId } = event.nativeEvent;

      if (phase === 'start' && closing) {
        completedClosingRouteKeysRef.current.delete(screenId);
        closingTransitionRouteKeysRef.current.add(screenId);
        return;
      }

      closingTransitionRouteKeysRef.current.delete(screenId);

      if (closing) {
        completedClosingRouteKeysRef.current.add(screenId);
      } else {
        completedClosingRouteKeysRef.current.delete(screenId);
      }

      clearRetainedRoute(screenId);
    },
    [clearRetainedRoute]
  );

  React.useEffect(() => {
    if (!topRouteKey || isTopRouteModal) {
      return;
    }

    const repair = () => {
      repairNativeScriptStackAfterDismiss(topRouteKey);
    };
    const lateRepair = setTimeout(repair, 420);
    const finalRepair = setTimeout(repair, 700);

    return () => {
      clearTimeout(lateRepair);
      clearTimeout(finalRepair);
    };
  }, [isTopRouteModal, topRouteKey]);

  return (
    <SafeAreaProviderCompat>
      <ScreenStack
        onNativeStackTransition={handleNativeStackTransition}
        style={styles.container}
      >
        {renderRouteRecords.map(({ descriptor, route, index }) => {
          const isRouteActive = activeRoutes.some(
            (activeRoute) => activeRoute.key === route.key
          );
          const isClosingRetainedRoute =
            !isRouteActive &&
            closingTransitionRouteKeysRef.current.has(route.key);
          const isFocused = isRouteActive && state.index === index;
          const previousKey = activeRoutes[index - 1]?.key;
          const nextKey = activeRoutes[index + 1]?.key;
          const previousDescriptor = previousKey
            ? descriptors[previousKey]
            : undefined;
          const nextDescriptor = nextKey ? descriptors[nextKey] : undefined;

          const nextPresentation = nextDescriptor?.options.presentation;

          const isNextScreenTransparent =
            nextPresentation != null &&
            TRANSPARENT_PRESENTATIONS.includes(nextPresentation);

          const isModal = modalRouteKeys.includes(route.key);

          return (
            <SceneView
              key={route.key}
              index={index}
              focused={isFocused}
              descriptor={descriptor}
              previousDescriptor={previousDescriptor}
              nextDescriptor={nextDescriptor}
              isPresentationModal={isModal}
              isNextScreenTransparent={isNextScreenTransparent}
              isInactive={
                !isRouteActive ? !isClosingRetainedRoute : index > state.index
              }
              isBeforeLast={index === activeRoutes.length - 2}
              onWillDisappear={() => {
                navigation.emit({
                  type: 'transitionStart',
                  data: { closing: true },
                  target: route.key,
                });
              }}
              onWillAppear={() => {
                navigation.emit({
                  type: 'transitionStart',
                  data: { closing: false },
                  target: route.key,
                });
              }}
              onAppear={() => {
                navigation.emit({
                  type: 'transitionEnd',
                  data: { closing: false },
                  target: route.key,
                });
              }}
              onDisappear={() => {
                navigation.emit({
                  type: 'transitionEnd',
                  data: { closing: true },
                  target: route.key,
                });
                clearRetainedRoute(route.key);
              }}
              onDismissed={(event) => {
                completedClosingRouteKeysRef.current.add(route.key);
                dispatchWithOriginalNavigation(navigation, {
                  ...StackActions.pop(event.nativeEvent.dismissCount),
                  source: route.key,
                  target: state.key,
                });

                setNextDismissedKey(route.key);
                clearRetainedRoute(route.key);

                const repair = () => {
                  repairNativeScriptStackAfterDismiss(route.key);
                };

                repair();
                setTimeout(repair, 64);
                setTimeout(repair, 250);
              }}
              onHeaderBackButtonClicked={() => {
                dispatchWithOriginalNavigation(navigation, {
                  ...StackActions.pop(),
                  source: route.key,
                  target: state.key,
                });
              }}
              onNativeDismissCancelled={(event) => {
                dispatchWithOriginalNavigation(navigation, {
                  ...StackActions.pop(event.nativeEvent.dismissCount),
                  source: route.key,
                  target: state.key,
                });
              }}
              onGestureCancel={() => {
                navigation.emit({
                  type: 'gestureCancel',
                  target: route.key,
                });
              }}
              onSheetDetentChanged={(event) => {
                navigation.emit({
                  type: 'sheetDetentChange',
                  target: route.key,
                  data: {
                    index: event.nativeEvent.index,
                    stable: event.nativeEvent.isStable,
                  },
                });
              }}
            />
          );
        })}
      </ScreenStack>
    </SafeAreaProviderCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    zIndex: 1,
  },
  absolute: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
  },
  translucent: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 1,
    elevation: 1,
  },
  background: {
    overflow: 'hidden',
  },
});
