import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../batches/domain/batch_capture_context.dart';

import 'scanner_launch_args.dart';
import '../../../shared/navigation/app_route_observer.dart';
import '../../../shared/theme/app_theme.dart';
import 'widgets/scanner_widgets.dart';

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({
    super.key,
    this.batchContext,
    this.launchMode = ScannerLaunchMode.scanSession,
  });

  final BatchCaptureContext? batchContext;
  final ScannerLaunchMode launchMode;

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen>
    with WidgetsBindingObserver, RouteAware, TickerProviderStateMixin {
  late MobileScannerController _controller;
  late final AnimationController _scanLineController;
  late final AnimationController _pulseController;

  bool _torchOn = false;
  bool _processing = false;
  bool _detected = false;
  int _cameraSession = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _createController();
    _scanLineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
      lowerBound: 0.96,
      upperBound: 1.02,
    )..repeat(reverse: true);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startController();
    });
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    _scanLineController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute<dynamic>) {
      appRouteObserver.unsubscribe(this);
      appRouteObserver.subscribe(this, route);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_controller.value.isInitialized) return;
    if (state == AppLifecycleState.paused) {
      _controller.stop();
    } else if (state == AppLifecycleState.resumed) {
      _startController();
    }
  }

  @override
  void didPopNext() {
    _restartCameraAfterVisible();
  }


  Future<void> _startController() async {
    if (!mounted) return;
    if (_controller.value.isRunning || _controller.value.isStarting) {
      return;
    }

    final delays = <Duration>[
      const Duration(milliseconds: 120),
      const Duration(milliseconds: 220),
      const Duration(milliseconds: 320),
    ];

    for (final delay in delays) {
      await Future<void>.delayed(delay);
      if (!mounted) return;

      try {
        await _controller.start();
        return;
      } catch (_) {
        // Ignore camera start races while the route settles and retry once more.
      }
    }
  }

  Future<void> _restartCameraAfterVisible() async {
    await _controller.stop();
    _controller.dispose();
    _createController();
    if (!mounted) return;

    setState(() {
      _cameraSession += 1;
      _torchOn = false;
    });

    await Future<void>.delayed(const Duration(milliseconds: 350));
    await _startController();
  }

  void _createController() {
    _controller = MobileScannerController(
      autoStart: false,
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      formats: const [BarcodeFormat.qrCode],
      torchEnabled: false,
    );
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final raw = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;

    setState(() {
      _processing = true;
      _detected = true;
    });
    await _controller.stop();
    await Future<void>.delayed(const Duration(milliseconds: 260));

    if (!mounted) return;
    context.pop(raw);
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    if (!mounted) return;
    setState(() => _torchOn = !_torchOn);
  }

  Future<void> _dismissScanner() async {
    await _controller.stop();
    if (!mounted) return;
    context.pop();
  }


  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          Positioned.fill(
            child: Container(color: AppColors.background),
          ),
          SafeArea(
            child: Column(
              children: [
                ScannerTopBar(
                  onBack: () => context.pop(),
                  onToggleTorch: _toggleTorch,
                  torchOn: _torchOn,
                ),
                if (widget.batchContext != null) ...[
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.inventory_2_rounded,
                            color: AppColors.accent,
                            size: 18,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Batch ${widget.batchContext!.batchRef} • ${widget.batchContext!.noticeText}',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 380),
                        child: AspectRatio(
                          aspectRatio: 0.78,
                          child: AnimatedBuilder(
                            animation: Listenable.merge([
                              _scanLineController,
                              _pulseController,
                            ]),
                            builder: (context, child) {
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(30),
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    if (child != null) ...[child],
                                    Center(
                                      child: ScannerFrame(
                                        progress: _scanLineController.value,
                                        pulseScale: _pulseController.value,
                                        active: !_processing,
                                        detected: _detected,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                KeyedSubtree(
                                  key: ValueKey(_cameraSession),
                                  child: MobileScanner(
                                    controller: _controller,
                                    onDetect: _onDetect,
                                    errorBuilder: (context, error) {
                                      return _CameraErrorView(
                                        error:
                                            'Camera error: ${error.errorDetails?.message ?? error.errorCode.name}',
                                        manualLabel: 'Close',
                                        onManualEntry: _dismissScanner,
                                      );
                                    },
                                  ),
                                ),
                                ScannerDetectedOverlay(visible: _detected),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                ScannerBottomPanel(
                  processing: _processing,
                  detected: _detected,
                  onManualEntry: _dismissScanner,
                  manualLabel: 'Close',
                  showManualEntryButton: false,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraErrorView extends StatelessWidget {
  const _CameraErrorView({
    required this.error,
    required this.manualLabel,
    required this.onManualEntry,
  });

  final String error;
  final String manualLabel;
  final Future<void> Function() onManualEntry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.camera_alt_rounded,
                size: 64,
                color: AppColors.textFaint,
              ),
              const SizedBox(height: 24),
              Text(
                error,
                style: TextStyle(color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await onManualEntry();
                  },
                  icon: const Icon(Icons.edit_rounded),
                  label: Text(manualLabel),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}










