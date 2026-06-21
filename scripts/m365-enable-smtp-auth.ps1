#Requires -Version 7.0
<#
.SYNOPSIS
  Enable SMTP AUTH for the manny@ mailbox and verify connect@ sender alias.

.DESCRIPTION
  connect@highvaluecapitalgroup.com is an alias on manny@highvaluecapitalgroup.com.
  Microsoft 365 SMTP AUTH uses the primary mailbox login (manny@), not the alias.
  Supabase should use manny@ as SMTP username and connect@ as sender (From) if alias sending is allowed.

  Run:
    pwsh ./scripts/m365-enable-smtp-auth.ps1

  Override admin login (defaults to manny@):
    pwsh ./scripts/m365-enable-smtp-auth.ps1 -AdminUpn manny@highvaluecapitalgroup.com

  Verify only (no changes):
    pwsh ./scripts/m365-enable-smtp-auth.ps1 -VerifyOnly
#>
param(
  [string]$AdminUpn = "manny@highvaluecapitalgroup.com",

  [string]$PrimaryMailbox = "manny@highvaluecapitalgroup.com",

  [string]$SenderAlias = "connect@highvaluecapitalgroup.com",

  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

function Write-Status([string]$Label, [string]$Value) {
  Write-Host ("{0,-44} {1}" -f ($Label + ":"), $Value)
}

if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
  Write-Error "ExchangeOnlineManagement module not installed. Run: Install-Module ExchangeOnlineManagement -Scope CurrentUser"
}

Import-Module ExchangeOnlineManagement

Write-Host "Connecting to Exchange Online as $AdminUpn (interactive MFA)..."
Connect-ExchangeOnline -UserPrincipalName $AdminUpn -ShowBanner:$false

try {
  $transport = Get-TransportConfig
  Write-Status "Org SmtpClientAuthenticationDisabled" $transport.SmtpClientAuthenticationDisabled

  $primary = Get-Mailbox -Identity $PrimaryMailbox -ErrorAction Stop
  Write-Status "Primary mailbox" $primary.PrimarySmtpAddress
  Write-Status "Display name" $primary.DisplayName
  Write-Status "Recipient type" $primary.RecipientTypeDetails

  $aliasViaIdentity = Get-Mailbox -Identity $SenderAlias -ErrorAction SilentlyContinue
  $aliasSmtp = "smtp:$SenderAlias"
  $addresses = @($primary.EmailAddresses | ForEach-Object { $_.ToString() })
  $aliasListedOnPrimary = $addresses -contains $aliasSmtp

  Write-Host ""
  Write-Host "--- Sender alias check ---"
  Write-Status "Alias address on primary mailbox" ($aliasListedOnPrimary.ToString())
  if ($aliasViaIdentity) {
    Write-Status "Alias resolves to same mailbox" ($aliasViaIdentity.Guid -eq $primary.Guid)
    Write-Status "Alias PrimarySmtpAddress" $aliasViaIdentity.PrimarySmtpAddress
  } else {
    Write-Status "Alias resolves via Get-Mailbox" "false"
  }

  $aliasOk = $aliasListedOnPrimary -or ($aliasViaIdentity -and $aliasViaIdentity.Guid -eq $primary.Guid)

  if ($aliasOk) {
    Write-Host "PASS: $SenderAlias is an alias on $PrimaryMailbox"
    Write-Host "  SMTP username (Supabase smtp_user): $PrimaryMailbox"
    Write-Host "  Sender email (Supabase smtp_admin_email): $SenderAlias"
    Write-Host "  Password: manny@ mailbox password (store only in Supabase, not in chat)"
  } else {
    Write-Host "WARN: $SenderAlias is not confirmed as an alias on $PrimaryMailbox"
    Write-Host "  Options:"
    Write-Host "    1. Add $SenderAlias as a proxy address on $PrimaryMailbox in Exchange Admin"
    Write-Host "    2. Create $SenderAlias as a shared mailbox with Send As permission"
    Write-Host "    3. Switch to Resend/Postmark for app email (recommended if alias sending is blocked)"
    if (-not $VerifyOnly) {
      Write-Host ""
      Write-Host "Continuing to enable SMTP AUTH on $PrimaryMailbox only..."
    }
  }

  Write-Host ""
  Write-Host "--- SMTP AUTH (primary mailbox only) ---"
  $cas = Get-CASMailbox -Identity $PrimaryMailbox
  Write-Status "SmtpClientAuthenticationDisabled (before)" $cas.SmtpClientAuthenticationDisabled

  if (-not $VerifyOnly -and $cas.SmtpClientAuthenticationDisabled -ne $false) {
    Write-Host "Enabling SMTP AUTH for $PrimaryMailbox..."
    Set-CASMailbox -Identity $PrimaryMailbox -SmtpClientAuthenticationDisabled $false
  }

  $casAfter = Get-CASMailbox -Identity $PrimaryMailbox
  Write-Status "SmtpClientAuthenticationDisabled (after)" $casAfter.SmtpClientAuthenticationDisabled

  $smtpAuthOk = $casAfter.SmtpClientAuthenticationDisabled -eq $false

  Write-Host ""
  Write-Host "--- Summary ---"
  if ($smtpAuthOk) {
    Write-Host "PASS: SMTP AUTH enabled for $PrimaryMailbox"
  } else {
    Write-Host "FAIL: SMTP AUTH still disabled for $PrimaryMailbox"
    Write-Host "  Security Defaults or Conditional Access may block SMTP AUTH."
    Write-Host "  Use Resend/Postmark or Azure Communication Services Email instead."
  }

  if ($aliasOk) {
    Write-Host "PASS: Alias sender configuration looks valid for Supabase"
    Write-Host "  After npm run smtp:configure, confirm invite email From: Growth Command Center <$SenderAlias>"
    Write-Host "  If From shows $PrimaryMailbox instead, Microsoft blocked alias From — use shared mailbox or Resend/Postmark."
  } else {
    Write-Host "FAIL: Alias sender not verified — fix alias or use Resend/Postmark before production invites"
  }

  if ($VerifyOnly) {
    exit ($(if ($smtpAuthOk -and $aliasOk) { 0 } else { 1 }))
  }

  if ($smtpAuthOk) {
    Write-Host ""
    Write-Host "Next: export SUPABASE_ACCESS_TOKEN and SMTP_MAILBOX_PASSWORD (manny@ password), then:"
    Write-Host "  npm run smtp:configure && npm run smtp:verify"
    exit $(if ($aliasOk) { 0 } else { 2 })
  }

  exit 1
}
finally {
  Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
}
