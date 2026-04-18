import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/theme/app_theme.dart';

/// Full-screen QR scanner screen.
/// On successful scan → calls parse-qr → navigates to sale entry.
/// "Enter Manually" bypasses the scanner entirely.
class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen>
    with WidgetsBindingObserver {
  late final MobileScannerController _controller;
  bool _torchOn = false;
  bool _processing = false; // prevents double-scan

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      formats: const [BarcodeFormat.qrCode],
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_controller.value.isInitialized) return;
    if (state == AppLifecycleState.paused) {
      _controller.stop();
    } else if (state == AppLifecycleState.resumed) {
      _controller.start();
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final raw = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;

    setState(() => _processing = true);
    _controller.stop();

    await _navigateToSaleEntry(rawQr: raw);
  }

  /// Parse QR and navigate to sale entry. Never throws.
  Future<void> _navigateToSaleEntry({required String rawQr}) async {
    if (!mounted) return;

    ParseQrResult result;
    try {
      final repo = ref.read(saleRepositoryProvider);
      result = await repo.parseQr(rawQr);
    } catch (_) {
      result = ParseQrResult.empty(rawQr);
    }

    if (!mounted) return;

    // Reset any previous sale entry state
    final saleEntryNotifier = ref.read(saleEntryProvider.notifier);
    saleEntryNotifier.reset();
    saleEntryNotifier.setParseResult(result);

    context.push('/sale-entry', extra: result);
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    setState(() => _torchOn = !_torchOn);
  }

  void _enterManually() {
    _controller.stop();
    final emptyResult = ParseQrResult.empty('');
    final saleEntryNotifier = ref.read(saleEntryProvider.notifier);
    saleEntryNotifier.reset();
    saleEntryNotifier.setParseResult(emptyResult);
    context.push('/sale-entry', extra: emptyResult);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          // ── Camera Feed ──────────────────────────────────────────────
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error, child) {
              return _CameraErrorView(
                error: 'Camera error: ${error.errorDetails?.message ?? error.errorCode.name}',
                onManualEntry: _enterManually,
              );
            },
          ),

          // ── Safe area UI overlay ─────────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                // Top bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => context.pop(),
                        icon: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary),
                        tooltip: 'Back',
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: _toggleTorch,
                        icon: Icon(
                          _torchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                          color: _torchOn
                              ? AppColors.accent
                              : AppColors.textPrimary,
                        ),
                        tooltip: 'Toggle torch',
                      ),
                    ],
                  ),
                ),

                const Spacer(),

                // Viewfinder frame hint
                _ScannerFrame(active: !_processing),

                const Spacer(),

                // Bottom actions
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
                  child: Column(
                    children: [
                      if (_processing)
                        const _ProcessingIndicator()
                      else
                        const Text(
                          'Point camera at QR code on jewellery',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                          textAlign: TextAlign.center,
                        ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: OutlinedButton.icon(
                          onPressed: _processing ? null : _enterManually,
                          icon: const Icon(Icons.edit_rounded, size: 18),
                          label: const Text('Enter Manually'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.textPrimary,
                            side: BorderSide(color: AppColors.border),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Sub-widgets ─────────────────────────────────────────────────────────────

class _ScannerFrame extends StatelessWidget {
  const _ScannerFrame({required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) {
    const size = 240.0;
    const cornerLen = 28.0;
    const cornerThick = 3.5;
    final gold = active ? AppColors.accent : AppColors.textFaint;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          // Top-left
          Positioned(
            top: 0,
            left: 0,
            child: _Corner(color: gold, length: cornerLen, thick: cornerThick,
                top: true, left: true),
          ),
          // Top-right
          Positioned(
            top: 0,
            right: 0,
            child: _Corner(color: gold, length: cornerLen, thick: cornerThick,
                top: true, left: false),
          ),
          // Bottom-left
          Positioned(
            bottom: 0,
            left: 0,
            child: _Corner(color: gold, length: cornerLen, thick: cornerThick,
                top: false, left: true),
          ),
          // Bottom-right
          Positioned(
            bottom: 0,
            right: 0,
            child: _Corner(color: gold, length: cornerLen, thick: cornerThick,
                top: false, left: false),
          ),
        ],
      ),
    );
  }
}

class _Corner extends StatelessWidget {
  const _Corner({
    required this.color,
    required this.length,
    required this.thick,
    required this.top,
    required this.left,
  });

  final Color color;
  final double length;
  final double thick;
  final bool top;
  final bool left;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: length,
      height: length,
      child: CustomPaint(
        painter: _CornerPainter(
            color: color, thick: thick, top: top, left: left),
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  _CornerPainter(
      {required this.color,
      required this.thick,
      required this.top,
      required this.left});

  final Color color;
  final double thick;
  final bool top;
  final bool left;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = thick
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();

    if (top && left) {
      path.moveTo(0, size.height);
      path.lineTo(0, 0);
      path.lineTo(size.width, 0);
    } else if (top && !left) {
      path.moveTo(0, 0);
      path.lineTo(size.width, 0);
      path.lineTo(size.width, size.height);
    } else if (!top && left) {
      path.moveTo(0, 0);
      path.lineTo(0, size.height);
      path.lineTo(size.width, size.height);
    } else {
      path.moveTo(0, size.height);
      path.lineTo(size.width, size.height);
      path.lineTo(size.width, 0);
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_CornerPainter old) => false;
}

class _ProcessingIndicator extends StatelessWidget {
  const _ProcessingIndicator();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.accent,
          ),
        ),
        SizedBox(width: 10),
        Text(
          'Reading QR...',
          style: TextStyle(color: AppColors.accent, fontSize: 14),
        ),
      ],
    );
  }
}

class _CameraErrorView extends StatelessWidget {
  const _CameraErrorView({required this.error, required this.onManualEntry});
  final String error;
  final VoidCallback onManualEntry;

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
              const Icon(Icons.camera_alt_rounded, size: 64, color: Colors.black26),
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
                  onPressed: onManualEntry,
                  icon: const Icon(Icons.edit_rounded),
                  label: const Text('Enter Sale Manually'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
