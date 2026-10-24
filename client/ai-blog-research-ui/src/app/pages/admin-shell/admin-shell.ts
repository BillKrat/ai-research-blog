// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminMenuService } from '../../services/admin-menu.service';

/**
 * The admin area frame: the server-supplied menu on the left (sections, items, a count badge, items for screens that are not
 * built yet shown dimmed) and the screen on the right. It renders what the server sends and nothing else: no list of screens,
 * no role checks.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell implements OnInit {
  private readonly menuService = inject(AdminMenuService);

  protected readonly menu = this.menuService.menu;

  ngOnInit(): void {
    this.menuService.load();
  }
}
