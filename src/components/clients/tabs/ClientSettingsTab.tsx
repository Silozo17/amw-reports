import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Mail, Save, Trash2, UserPlus, Users } from 'lucide-react';
import type { Client } from '@/types/database';
import { CURRENCY_OPTIONS } from '@/types/database';
import { TIMEZONE_OPTIONS } from '@/types/metrics';

interface ClientSettingsTabProps {
  client: Client;
  clientUsers: { id: string; invited_email: string; user_id: string; created_at: string }[];
  inviteEmail: string;
  isInviting: boolean;
  onInviteEmailChange: (email: string) => void;
  onInviteClient: () => void;
  onRevokeClientUser: (cuId: string) => void;
  onSettingChange: (field: string, value: string | boolean) => void;
}

const ClientSettingsTab = ({
  client,
  clientUsers,
  inviteEmail,
  isInviting,
  onInviteEmailChange,
  onInviteClient,
  onRevokeClientUser,
  onSettingChange,
}: ClientSettingsTabProps) => {
  return (
    <>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Report Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Detail Level</p>
              <p className="text-xs text-muted-foreground">How detailed reports should be</p>
            </div>
            <Select value={client.report_detail_level} onValueChange={v => onSettingChange('report_detail_level', v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Report Language</p>
              <p className="text-xs text-muted-foreground">Language used for report text</p>
            </div>
            <Select value={client.report_language ?? 'en'} onValueChange={v => onSettingChange('report_language', v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="pl">Polish</SelectItem>
                <SelectItem value="da">Danish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {[
            { key: 'enable_mom_comparison', label: 'MoM Comparison', desc: 'Compare with previous month' },
            { key: 'enable_yoy_comparison', label: 'YoY Comparison', desc: 'Compare with same month last year' },
            { key: 'enable_explanations', label: 'AI Explanations', desc: 'Plain-English insights in reports' },
            { key: 'enable_upsell', label: 'Upsell Section', desc: 'Recommend AMW services in reports' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={client[item.key as keyof Client] as boolean}
                onCheckedChange={v => onSettingChange(item.key, v)}
              />
            </div>
          ))}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Currency</p>
                <p className="text-xs text-muted-foreground">Currency used in reports</p>
              </div>
              <Select value={client.preferred_currency} onValueChange={v => onSettingChange('preferred_currency', v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Timezone</p>
                <p className="text-xs text-muted-foreground">Timezone for data reporting</p>
              </div>
              <Select value={client.preferred_timezone} onValueChange={v => onSettingChange('preferred_timezone', v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Preferences */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'email_report_delivery', label: 'Report Delivery', desc: 'Send generated reports via email' },
            { key: 'email_weekly_update', label: 'Weekly Updates', desc: 'Send weekly performance summaries' },
            { key: 'email_monthly_digest', label: 'Monthly Digest', desc: 'Send monthly overview digest' },
            { key: 'email_alert_warnings', label: 'Alert Warnings', desc: 'Send alerts when something goes wrong (e.g. sync failures, token expiry)' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={client[item.key as keyof Client] as boolean}
                onCheckedChange={v => onSettingChange(item.key, v)}
              />
            </div>
          ))}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Recipient</p>
                <p className="text-xs text-muted-foreground">Who receives emails for this client</p>
              </div>
              <Select value={client.email_recipient_mode ?? 'agency'} onValueChange={v => onSettingChange('email_recipient_mode', v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency Only</SelectItem>
                  <SelectItem value="client">Client Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Context */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-display text-lg">Business Context</CardTitle>
          <p className="text-xs text-muted-foreground">Help AI generate more relevant insights by providing business context</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Industry</p>
              <Select value={client.industry ?? ''} onValueChange={v => onSettingChange('industry', v)}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {[
                    'Automotive', 'Beauty & Wellness', 'Construction', 'Dental', 'E-commerce',
                    'Education', 'Events & Entertainment', 'Finance & Insurance', 'Fitness & Gym',
                    'Food & Beverage', 'Healthcare', 'Home Services', 'Hospitality & Hotels',
                    'Legal', 'Manufacturing', 'Marketing & Agency', 'Non-Profit',
                    'Professional Services', 'Real Estate', 'Recruitment', 'Retail',
                    'SaaS & Technology', 'Sports', 'Travel & Tourism', 'Trades & Plumbing',
                    'Veterinary', 'Other',
                  ].map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Service Area</p>
              <Select value={client.service_area_type ?? 'local'} onValueChange={v => onSettingChange('service_area_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="international">International</SelectItem>
                  <SelectItem value="worldwide">Worldwide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Service Areas (Specific)</p>
            <Input
              value={client.service_areas ?? ''}
              onChange={e => onSettingChange('service_areas', e.target.value)}
              placeholder="e.g. Greater Manchester, Leeds, Liverpool"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Target Audience</p>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={client.target_audience ?? ''}
              onChange={e => onSettingChange('target_audience', e.target.value)}
              placeholder="e.g. First-time homebuyers aged 25-40 in London"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Business Goals</p>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={client.business_goals ?? ''}
              onChange={e => onSettingChange('business_goals', e.target.value)}
              placeholder="e.g. Increase leads by 30%, grow Instagram following"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Competitors</p>
            <Input
              value={client.competitors ?? ''}
              onChange={e => onSettingChange('competitors', e.target.value)}
              placeholder="e.g. Competitor A, Competitor B"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Unique Selling Points</p>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={client.unique_selling_points ?? ''}
              onChange={e => onSettingChange('unique_selling_points', e.target.value)}
              placeholder="e.g. 24/7 support, free consultations, 20 years experience"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Brand Voice</p>
            <Input
              value={client.brand_voice ?? ''}
              onChange={e => onSettingChange('brand_voice', e.target.value)}
              placeholder="e.g. Professional but friendly, avoid jargon"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Self-Service Access */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Client Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite your client to log in and manage their own platform connections via magic link.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="client@company.com"
              value={inviteEmail}
              onChange={e => onInviteEmailChange(e.target.value)}
              className="flex-1"
            />
            <Button onClick={onInviteClient} disabled={isInviting || !inviteEmail.trim()} size="sm">
              {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Invite
            </Button>
          </div>
          {clientUsers.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invited Users</p>
              {clientUsers.map(cu => (
                <div key={cu.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-body">{cu.invited_email}</p>
                    <p className="text-xs text-muted-foreground">Invited {new Date(cu.created_at).toLocaleDateString()}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {cu.invited_email}'s ability to log in and manage connections for this client.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRevokeClientUser(cu.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ClientSettingsTab;
