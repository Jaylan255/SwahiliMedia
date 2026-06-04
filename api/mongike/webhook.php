<?php

declare(strict_types=1);

require_once dirname(dirname(__DIR__)) . '/security/bootstrap.php';

security_bootstrap(false);
security_rate_limit('mongike_webhook', 120, 300);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    security_json_response([
        'status' => 'error',
        'message' => 'Method not allowed'
    ], 405);
}

$apiKey = getenv('MONGIKE_API_KEY');
$incomingKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!$apiKey || !hash_equals((string) $apiKey, (string) $incomingKey)) {
    security_log_event('mongike_webhook_unauthorized');
    security_json_response([
        'status' => 'error',
        'message' => 'Invalid webhook signature'
    ], 401);
}

$rawInput = file_get_contents('php://input');
security_log_event('mongike_webhook_received', [
    'payload_sha256' => hash('sha256', (string) $rawInput),
    'payload_size' => strlen((string) $rawInput),
]);

security_json_response([
    'status' => 'success',
    'message' => 'Webhook received'
], 200);
