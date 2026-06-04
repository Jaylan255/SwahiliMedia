<?php

declare(strict_types=1);

require_once dirname(dirname(__DIR__)) . '/security/bootstrap.php';

security_bootstrap(false);
security_rate_limit('client_security_event', 80, 300);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    security_json_response([
        'status' => 'error',
        'message' => 'Method not allowed',
    ], 405);
}

$body = security_read_json_body();
$eventType = trim((string) ($body['eventType'] ?? ''));
$details = $body['details'] ?? [];

$allowedEvents = [
    'copy_attempt',
    'context_menu',
    'save_shortcut',
    'devtools_shortcut',
    'print_shortcut',
    'selection_attempt',
];

if (!in_array($eventType, $allowedEvents, true)) {
    security_json_response([
        'status' => 'error',
        'message' => 'Unsupported event type.',
    ], 422);
}

security_log_event('client_security_event', [
    'event_type' => $eventType,
    'details' => is_array($details) ? $details : [],
]);

security_json_response([
    'status' => 'success',
    'message' => 'Event logged.',
], 200);
