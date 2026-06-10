import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
import { User, ROLE_NAMES } from '../../models';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  users: User[] = [];
  currentUser!: User;
  userDropdownOpen = false;
  readonly ROLE_NAMES = ROLE_NAMES;

  constructor(
    private authService: AuthService,
    private eRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.authService.users$.subscribe((u) => (this.users = u));
    this.authService.currentUser$.subscribe((u) => (this.currentUser = u));
    this.authService.loadUsers();
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any): void {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.userDropdownOpen = false;
    }
  }

  toggleDropdown(): void {
    this.userDropdownOpen = !this.userDropdownOpen;
  }

  selectUser(user: User): void {
    this.authService.switchUser(user);
    this.userDropdownOpen = false;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0);
  }
}
